import type { ProjectMode } from './genesis-protocol';
import { cleanFluentArtifactBody, hasProtocolLeakage } from './artifact-normalizer';

export type SoulIntentTarget = 'auto' | 'bible' | 'beat_sheet' | 'screenplay';

interface CanonicalBrick {
    id: string;
    persona: string;
    instruction: string;
    confidence: number;
    verifiedAt: number;
    artifact: string;
}

interface CanonicalManifest {
    metadata?: {
        name?: string;
        domain?: string;
        generatedAt?: number;
        originalPrompt?: string;
    };
    bricks?: CanonicalBrick[];
    securityAddendum?: {
        content?: string;
    } | null;
}

export interface SoulComposerInput {
    canonicalManifest: string | CanonicalManifest;
    mode?: ProjectMode;
    intentTarget?: SoulIntentTarget;
}

export interface SoulComposerOutput {
    manifestSoul: string;
    diagnostics: string[];
    fidelity: {
        canonicalBrickCount: number;
        includedBrickCount: number;
        missingBrickIds: string[];
    };
}

interface CleanBrick extends CanonicalBrick {
    fluentArtifact: string;
}

const CREATIVE_SECTION_ORDER = [
    'Series Premise',
    'Canon Rules',
    'Character Constellation',
    'Season Arcs',
    'Episode Beats',
    'World Glossary',
    'Open Threads'
] as const;

export function composeSoulDocument(input: SoulComposerInput): SoulComposerOutput {
    const diagnostics: string[] = [];
    let canonical: CanonicalManifest;

    if (typeof input.canonicalManifest === 'string') {
        try {
            canonical = JSON.parse(input.canonicalManifest) as CanonicalManifest;
        } catch {
            return {
                manifestSoul: '# Soul Document\n\nUnable to parse canonical manifest.',
                diagnostics: ['Invalid canonical manifest JSON.'],
                fidelity: {
                    canonicalBrickCount: 0,
                    includedBrickCount: 0,
                    missingBrickIds: []
                }
            };
        }
    } else {
        canonical = input.canonicalManifest;
    }

    const bricks = Array.isArray(canonical.bricks) ? canonical.bricks : [];
    const cleaned = collapseDuplicateBricks(
        bricks
            .map((brick) => ({
                ...brick,
                fluentArtifact: cleanFluentArtifactBody(brick.artifact || '')
            }))
            .filter((brick) => {
                if (!brick.fluentArtifact) {
                    diagnostics.push(`Dropped empty/diagnostic brick: ${brick.id}`);
                    return false;
                }
                if (hasProtocolLeakage(brick.fluentArtifact)) {
                    diagnostics.push(`Protocol leakage scrubbed in brick: ${brick.id}`);
                }
                return true;
            })
    );

    const intent = resolveIntent(input.intentTarget, canonical.metadata?.originalPrompt);
    const mode = input.mode || 'software';

    let body = '';
    if (mode === 'creative_writing') {
        body = composeCreative(cleaned, intent, diagnostics);
    } else {
        body = composeGeneral(cleaned);
    }

    const title = canonical.metadata?.name || 'Project Soul';
    const domain = canonical.metadata?.domain || 'Unknown';
    const generated = new Date().toISOString();

    const manifestSoul = [
        `# ${title} - Soul Document`,
        '',
        `**Domain:** ${domain}`,
        `**Generated:** ${generated}`,
        '',
        body,
        canonical.securityAddendum?.content
            ? ['---', '', '## Diagnostics Appendix', '', cleanFluentArtifactBody(canonical.securityAddendum.content)].join('\n')
            : ''
    ].filter(Boolean).join('\n');

    const includedIds = new Set(cleaned.map((brick) => brick.id));
    const missing = bricks.filter((brick) => !includedIds.has(brick.id)).map((brick) => brick.id);

    return {
        manifestSoul,
        diagnostics,
        fidelity: {
            canonicalBrickCount: bricks.length,
            includedBrickCount: cleaned.length,
            missingBrickIds: missing
        }
    };
}

function resolveIntent(intent: SoulIntentTarget | undefined, originalPrompt: string | undefined): SoulIntentTarget {
    if (intent && intent !== 'auto') return intent;
    const prompt = (originalPrompt || '').toLowerCase();
    if (/screenplay|full script|script format|scene heading/.test(prompt)) return 'screenplay';
    if (/beat sheet|episode beats|story beats/.test(prompt)) return 'beat_sheet';
    return 'bible';
}

function collapseDuplicateBricks(bricks: CleanBrick[]): CleanBrick[] {
    const seen = new Set<string>();
    const unique: CleanBrick[] = [];

    const sorted = [...bricks].sort((a, b) => (a.verifiedAt || 0) - (b.verifiedAt || 0));
    for (const brick of sorted) {
        const key = `${(brick.instruction || '').trim().toLowerCase()}::${brick.fluentArtifact.trim().toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(brick);
    }

    return unique;
}

function composeCreative(bricks: CleanBrick[], intent: SoulIntentTarget, diagnostics: string[]): string {
    if (intent === 'screenplay') {
        return composeScreenplayBeats(bricks);
    }

    if (intent === 'beat_sheet') {
        const lines: string[] = ['## Episode Beat Sheet', ''];
        bricks.forEach((brick, idx) => {
            lines.push(`### Beat ${idx + 1}: ${brick.instruction}`);
            lines.push('');
            lines.push(brick.fluentArtifact);
            lines.push('');
        });
        return lines.join('\n');
    }

    const buckets: Record<string, CleanBrick[]> = Object.fromEntries(
        CREATIVE_SECTION_ORDER.map((section) => [section, []])
    );

    for (const brick of bricks) {
        const section = mapCreativeSection(brick);
        buckets[section].push(brick);
    }

    const lines: string[] = [];
    CREATIVE_SECTION_ORDER.forEach((section) => {
        const sectionBricks = buckets[section] || [];
        if (sectionBricks.length === 0) return;
        lines.push(`## ${section}`);
        lines.push('');
        sectionBricks.forEach((brick) => {
            lines.push(`### ${brick.instruction}`);
            lines.push('');
            lines.push(brick.fluentArtifact);
            lines.push('');
        });
    });

    if (lines.length === 0) {
        diagnostics.push('Creative mode buckets were empty; fell back to flat composition.');
        return composeGeneral(bricks);
    }

    return lines.join('\n');
}

function composeScreenplayBeats(bricks: CleanBrick[]): string {
    const lines: string[] = ['## Screenplay Draft Skeleton', ''];
    if (bricks.length === 0) return lines.join('\n');

    const splitA = Math.max(1, Math.ceil(bricks.length * 0.33));
    const splitB = Math.max(splitA + 1, Math.ceil(bricks.length * 0.66));

    const acts = [
        { title: 'ACT I - Setup', range: bricks.slice(0, splitA) },
        { title: 'ACT II - Confrontation', range: bricks.slice(splitA, splitB) },
        { title: 'ACT III - Resolution', range: bricks.slice(splitB) }
    ];

    acts.forEach((act) => {
        if (act.range.length === 0) return;
        lines.push(`## ${act.title}`);
        lines.push('');
        act.range.forEach((brick, index) => {
            lines.push(`### Scene ${index + 1}: ${brick.instruction}`);
            lines.push('');
            lines.push(brick.fluentArtifact);
            lines.push('');
        });
    });

    return lines.join('\n');
}

function composeGeneral(bricks: CleanBrick[]): string {
    const grouped: Record<string, CleanBrick[]> = {
        Architecture: [],
        Security: [],
        'Data & Storage': [],
        'API & Interfaces': [],
        'Algorithm & Logic': [],
        General: []
    };

    bricks.forEach((brick) => {
        const text = `${brick.persona} ${brick.instruction}`.toLowerCase();
        if (/security|auth|risk|threat/.test(text)) grouped.Security.push(brick);
        else if (/data|storage|database|schema/.test(text)) grouped['Data & Storage'].push(brick);
        else if (/api|interface|contract|endpoint/.test(text)) grouped['API & Interfaces'].push(brick);
        else if (/algorithm|logic|workflow|execution/.test(text)) grouped['Algorithm & Logic'].push(brick);
        else if (/architecture|system|design|topology/.test(text)) grouped.Architecture.push(brick);
        else grouped.General.push(brick);
    });

    const lines: string[] = [];
    Object.entries(grouped).forEach(([section, sectionBricks]) => {
        if (sectionBricks.length === 0) return;
        lines.push(`## ${section}`);
        lines.push('');
        sectionBricks.forEach((brick) => {
            lines.push(`### ${brick.instruction}`);
            lines.push('');
            lines.push(brick.fluentArtifact);
            lines.push('');
        });
    });

    return lines.join('\n');
}

function mapCreativeSection(brick: CleanBrick): typeof CREATIVE_SECTION_ORDER[number] {
    const text = `${brick.instruction} ${brick.fluentArtifact}`.toLowerCase();
    if (/premise|hook|logline|elevator pitch/.test(text)) return 'Series Premise';
    if (/canon|rule|constraint|law/.test(text)) return 'Canon Rules';
    if (/character|protagonist|antagonist|arc/.test(text)) return 'Character Constellation';
    if (/season|act|arc/.test(text)) return 'Season Arcs';
    if (/episode|beat|scene|sequence|screenplay/.test(text)) return 'Episode Beats';
    if (/world|glossary|lore|location/.test(text)) return 'World Glossary';
    return 'Open Threads';
}

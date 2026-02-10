/**
 * The Blackboard Delta (The Living Constitution) - Section 4.5
 * 
 * Concept: Global State Synchronization
 * 
 * The Blackboard is not just a notepad—it is a LIVING CONSTITUTION.
 * Every decision made by an agent must be contractually binding on all future agents.
 * 
 * Mechanism:
 * - When a Brick is verified, its `### BLACKBOARD DELTA` is parsed
 * - The delta is merged into the Global Context
 * - Effect: Agent B (Step 10) can explicitly see the decisions made by Agent A (Step 5)
 * 
 * This ensures that all agents operate on a consistent, evolving state
 * rather than each having their own isolated context.
 * 
 * █ ANCHOR 2: BLACKBOARD DELTA (The Living Constitution)
 * 1. Global Context (State)
 * 2. Merge Logic (Decisions)
 * 3. Conflict Detection (Heuristic)
 * 4. Delta Parsing (Safe)
 */

import { BlackboardDelta } from './specialist';
import { safeYamlParse } from '../utils/safe-json';

// ============================================================================
// TYPES
// ============================================================================

export interface GlobalContext {
    // █ ANCHOR 2.1: The Global Context (State)
    /** The original user requirements */
    originalRequirements: string;

    /** Project domain (e.g., "Web App", "API Service") */
    domain: string;

    /** Technology stack in use */
    techStack: string[];

    /** All accumulated constraints (binding on all agents) */
    constraints: string[];

    /** All decisions made by previous agents (immutable) */
    decisions: string[];

    /** Warnings from previous agents (advisory) */
    warnings: string[];

    /** Timestamp of last update */
    lastUpdated: number;

    /** Number of deltas merged */
    deltaCount: number;
}

export interface DeltaMergeResult {
    /** Whether the merge was successful */
    success: boolean;

    /** The updated global context */
    updatedContext: GlobalContext;

    /** What was added in this merge */
    additions: {
        constraints: string[];
        decisions: string[];
        warnings: string[];
    };

    /** Any conflicts detected during merge */
    conflicts: string[];

    /** Summary of the merge for logging */
    summary: string;
}

export interface VerifiedBrick {
    /** Unique identifier for the brick */
    id: string;

    /** The specialist's persona that created this brick */
    persona: string;

    /** The atomic instruction this brick addresses */
    instruction: string;

    /** The verified artifact content */
    artifact: string;

    /** The blackboard delta from this brick */
    delta: BlackboardDelta;

    /** Timestamp of verification */
    verifiedAt: number;

    /** The antagonist's confidence score */
    confidence: number;
}

// ============================================================================
// BLACKBOARD DELTA MANAGER
// ============================================================================

export class BlackboardDeltaManager {
    private globalContext: GlobalContext;
    private verifiedBricks: VerifiedBrick[] = [];
    private onContextUpdate?: (context: GlobalContext) => void;

    constructor(
        initialContext?: Partial<GlobalContext>,
        onContextUpdate?: (context: GlobalContext) => void
    ) {
        this.globalContext = {
            originalRequirements: initialContext?.originalRequirements || '',
            domain: initialContext?.domain || 'Unknown',
            techStack: initialContext?.techStack || [],
            constraints: initialContext?.constraints || [],
            decisions: initialContext?.decisions || [],
            warnings: initialContext?.warnings || [],
            lastUpdated: Date.now(),
            deltaCount: 0
        };
        this.onContextUpdate = onContextUpdate;
    }

    /**
     * Initialize the global context from project setup (Genesis Protocol output)
     */
    initialize(
        originalRequirements: string,
        domain: string,
        techStack: string[],
        constraints: string[]
    ): void {
        this.globalContext = {
            originalRequirements,
            domain,
            techStack,
            constraints: [...constraints],
            decisions: [],
            warnings: [],
            lastUpdated: Date.now(),
            deltaCount: 0
        };
        this.verifiedBricks = [];
        this.notifyUpdate();
    }

    /**
     * Merge a verified brick's delta into the global context
     * Called AFTER Antagonist marks a brick as verified
     * 
     * @param brick - The verified brick to merge
     * @returns DeltaMergeResult with details of the merge
     */
    mergeDelta(brick: VerifiedBrick): DeltaMergeResult {
        // █ ANCHOR 2.2: Context Merging Logic
        const delta = brick.delta;
        const additions = {
            constraints: [] as string[],
            decisions: [] as string[],
            warnings: [] as string[]
        };
        const conflicts: string[] = [];

        // Merge new constraints (check for duplicates and conflicts)
        for (const rawConstraint of delta.newConstraints) {
            if (!rawConstraint || typeof rawConstraint !== 'string') continue;
            const constraint = rawConstraint.trim();
            if (constraint.length === 0) continue;

            // Check for duplicate
            if (this.globalContext.constraints.includes(constraint)) {
                continue; // Skip duplicate
            }

            // Check for potential conflict (simple heuristic)
            const conflicting = this.detectConflict(constraint, this.globalContext.constraints);
            if (conflicting) {
                conflicts.push(`New constraint "${constraint}" may conflict with existing: "${conflicting}"`);
                // Still add it, but log the conflict
            }

            this.globalContext.constraints.push(constraint);
            additions.constraints.push(constraint);
        }

        // Merge decisions (immutable - never remove, only add)
        for (const rawDecision of delta.decisions) {
            if (!rawDecision || typeof rawDecision !== 'string') continue;
            const decision = rawDecision.trim();
            if (decision.length === 0) continue;

            // Add agent attribution
            const attributed = `[${brick.persona}] ${decision}`;

            if (!this.globalContext.decisions.includes(attributed)) {
                this.globalContext.decisions.push(attributed);
                additions.decisions.push(attributed);
            }
        }

        // Merge warnings
        for (const rawWarning of delta.warnings) {
            if (!rawWarning || typeof rawWarning !== 'string') continue;
            const warning = rawWarning.trim();
            if (warning.length === 0) continue;

            const attributed = `[${brick.persona}] ${warning}`;

            if (!this.globalContext.warnings.includes(attributed)) {
                this.globalContext.warnings.push(attributed);
                additions.warnings.push(attributed);
            }
        }

        // Update metadata
        this.globalContext.lastUpdated = Date.now();
        this.globalContext.deltaCount++;

        // Store the verified brick
        this.verifiedBricks.push(brick);

        // Notify listeners
        this.notifyUpdate();

        // Generate summary
        const summary = this.generateMergeSummary(brick, additions, conflicts);

        return {
            success: true,
            updatedContext: { ...this.globalContext },
            additions,
            conflicts,
            summary
        };
    }

    /**
     * Get the current global context (Living Constitution)
     * This should be injected into every Specialist's prompt
     */
    getGlobalContext(): GlobalContext {
        return { ...this.globalContext };
    }

    /**
     * Get the Living Constitution as a formatted string for injection
     */
    getLivingConstitution(): string {
        const ctx = this.globalContext;

        let output = `# THE LIVING CONSTITUTION\n`;
        output += `Last Updated: ${new Date(ctx.lastUpdated).toISOString()}\n`;
        output += `Verified Bricks: ${this.verifiedBricks.length}\n\n`;

        output += `## ORIGINAL REQUIREMENTS\n${ctx.originalRequirements}\n\n`;

        output += `## PROJECT DOMAIN\n${ctx.domain}\n\n`;

        output += `## TECHNOLOGY STACK\n`;
        ctx.techStack.forEach(tech => {
            output += `- ${tech}\n`;
        });
        output += '\n';

        output += `## BINDING CONSTRAINTS\n`;
        output += `These constraints are IMMUTABLE and must be followed by ALL agents.\n\n`;
        if (ctx.constraints.length === 0) {
            output += `- No constraints defined yet.\n`;
        } else {
            ctx.constraints.forEach(c => {
                output += `- ${c}\n`;
            });
        }
        output += '\n';

        output += `## DECISIONS MADE (IMMUTABLE)\n`;
        output += `These decisions were made by previous agents and CANNOT be changed.\n\n`;
        if (ctx.decisions.length === 0) {
            output += `- No decisions made yet.\n`;
        } else {
            ctx.decisions.forEach(d => {
                output += `- ${d}\n`;
            });
        }
        output += '\n';

        output += `## WARNINGS FROM PREVIOUS AGENTS\n`;
        if (ctx.warnings.length === 0) {
            output += `- No warnings.\n`;
        } else {
            ctx.warnings.forEach(w => {
                output += `- ⚠️ ${w}\n`;
            });
        }

        return output;
    }

    /**
     * Get all verified bricks
     */
    getVerifiedBricks(): VerifiedBrick[] {
        return [...this.verifiedBricks];
    }

    /**
     * Get a summary of decisions visible to a specific step
     * Useful for understanding what Agent B at Step N can see
     */
    getDecisionsVisibleAt(stepNumber: number): string[] {
        // All decisions from bricks verified before this step
        return this.verifiedBricks
            .filter((_, index) => index < stepNumber)
            .flatMap(brick => brick.delta.decisions.map(d => `[${brick.persona}] ${d}`));
    }

    /**
     * Detect potential conflicts between a new constraint and existing ones
     * Returns the conflicting constraint if found, null otherwise
     */
    private detectConflict(newConstraint: string, existing: string[]): string | null {
        // █ ANCHOR 2.3: Conflict Detection (Heuristic)
        const newLower = newConstraint.toLowerCase();

        // Simple heuristics for conflict detection
        const negationPatterns = [
            { positive: /must use/i, negative: /must not use|cannot use|don't use/i },
            { positive: /always/i, negative: /never/i },
            { positive: /required/i, negative: /forbidden|prohibited/i },
            { positive: /include/i, negative: /exclude/i }
        ];

        for (const constraint of existing) {
            const existingLower = constraint.toLowerCase();

            // Check for direct negation patterns
            for (const pattern of negationPatterns) {
                const newHasPositive = pattern.positive.test(newLower);
                const newHasNegative = pattern.negative.test(newLower);
                const existingHasPositive = pattern.positive.test(existingLower);
                const existingHasNegative = pattern.negative.test(existingLower);

                // Conflict if one says "must" and other says "must not" for similar topic
                if ((newHasPositive && existingHasNegative) || (newHasNegative && existingHasPositive)) {
                    // Check if they're about the same topic (shared significant words)
                    const newWords = newLower.split(/\s+/).filter(w => w.length > 4);
                    const existingWords = existingLower.split(/\s+/).filter(w => w.length > 4);
                    const overlap = newWords.filter(w => existingWords.includes(w));

                    if (overlap.length > 0) {
                        return constraint;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Generate a summary of the merge operation
     */
    private generateMergeSummary(
        brick: VerifiedBrick,
        additions: { constraints: string[]; decisions: string[]; warnings: string[] },
        conflicts: string[]
    ): string {
        const parts: string[] = [];

        parts.push(`Delta merged from [${brick.persona}]`);

        if (additions.constraints.length > 0) {
            parts.push(`+${additions.constraints.length} constraints`);
        }
        if (additions.decisions.length > 0) {
            parts.push(`+${additions.decisions.length} decisions`);
        }
        if (additions.warnings.length > 0) {
            parts.push(`+${additions.warnings.length} warnings`);
        }
        if (conflicts.length > 0) {
            parts.push(`⚠️ ${conflicts.length} potential conflicts`);
        }

        return parts.join(' | ');
    }

    /**
     * Notify listeners of context update
     */
    private notifyUpdate(): void {
        if (this.onContextUpdate) {
            this.onContextUpdate({ ...this.globalContext });
        }
    }

    /**
     * Reset the blackboard (for new sessions)
     */
    reset(): void {
        this.globalContext = {
            originalRequirements: '',
            domain: 'Unknown',
            techStack: [],
            constraints: [],
            decisions: [],
            warnings: [],
            lastUpdated: Date.now(),
            deltaCount: 0
        };
        this.verifiedBricks = [];
        this.notifyUpdate();
    }

    /**
     * Export the current state for persistence
     */
    export(): { context: GlobalContext; bricks: VerifiedBrick[] } {
        return {
            context: { ...this.globalContext },
            bricks: [...this.verifiedBricks]
        };
    }

    /**
     * Import state from persistence
     */
    import(data: { context: GlobalContext; bricks: VerifiedBrick[] }): void {
        this.globalContext = { ...data.context };
        this.verifiedBricks = [...data.bricks];
        this.notifyUpdate();
    }
}

// ============================================================================
// DELTA PARSER
// ============================================================================

/**
 * Parse a raw response to extract the Blackboard Delta
 * V2.99 Soft-Strict Protocol: YAML-first, JSON-fallback, structured text last resort
 */
export function parseBlackboardDelta(rawResponse: string): BlackboardDelta {
    // █ ANCHOR 2.4: Delta Parsing (Safe Extraction)
    const defaultDelta: BlackboardDelta = {
        newConstraints: [],
        decisions: [],
        warnings: []
    };

    try {
        // Find the BLACKBOARD DELTA section
        const deltaMatch = rawResponse.match(/###\s*BLACKBOARD DELTA\s*\n([\s\S]*?)(?=###\s*ARTIFACT|$)/i);
        if (!deltaMatch) {
            return defaultDelta;
        }

        const deltaSection = deltaMatch[1].trim();

        // Strategy 1: Try YAML extraction (V2.99 preferred format)
        const yamlResult = safeYamlParse<{
            newConstraints?: string[];
            decisions?: string[];
            warnings?: string[];
        }>(deltaSection, null);

        if (yamlResult.success && yamlResult.data) {
            console.log('[BlackboardDelta:SoftStrict] Successfully parsed YAML delta');
            return sanitizeDelta({
                newConstraints: yamlResult.data.newConstraints || [],
                decisions: yamlResult.data.decisions || [],
                warnings: yamlResult.data.warnings || []
            });
        }

        // Strategy 2: Try JSON extraction (backward compatibility)
        const jsonMatch = deltaSection.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                console.log('[BlackboardDelta:SoftStrict] Successfully parsed JSON delta (fallback)');
                return sanitizeDelta({
                    newConstraints: parsed.newConstraints || [],
                    decisions: parsed.decisions || [],
                    warnings: parsed.warnings || []
                });
            } catch (jsonError) {
                // JSON parsing failed, continue to structured text
            }
        }

        // Strategy 3: Try raw JSON parse (no code block)
        try {
            const braceStart = deltaSection.indexOf('{');
            const braceEnd = deltaSection.lastIndexOf('}');
            if (braceStart !== -1 && braceEnd > braceStart) {
                const jsonStr = deltaSection.substring(braceStart, braceEnd + 1);
                const parsed = JSON.parse(jsonStr);
                console.log('[BlackboardDelta:SoftStrict] Successfully parsed raw JSON delta');
                return sanitizeDelta({
                    newConstraints: parsed.newConstraints || [],
                    decisions: parsed.decisions || [],
                    warnings: parsed.warnings || []
                });
            }
        } catch {
            // Continue to structured text
        }

        // Strategy 4: Parse as structured text (last resort)
        console.log('[BlackboardDelta:SoftStrict] Using structured text fallback');
        return sanitizeDelta(parseStructuredDelta(deltaSection));
    } catch (e) {
        console.warn('[BlackboardDelta:SoftStrict] All parsing strategies failed:', e);
        return defaultDelta;
    }
}

/**
 * Sanitize a delta object to ensure it strictly conforms to the BlackboardDelta interface
 * This protects the core system from model hallucinations (e.g. objects instead of strings)
 */
function sanitizeDelta(raw: any): BlackboardDelta {
    return {
        newConstraints: ensureStringArray(raw.newConstraints),
        decisions: ensureStringArray(raw.decisions),
        warnings: ensureStringArray(raw.warnings)
    };
}

/**
 * Helper to ensure an array contains only valid strings
 */
function ensureStringArray(arr: any): string[] {
    if (!Array.isArray(arr)) return [];

    return arr
        .map(item => {
            if (typeof item === 'string') return item.trim();
            if (typeof item === 'number') return String(item);
            if (item && typeof item === 'object') {
                // Try to extract text content if model returned object wrapper
                // e.g. { "decision": "The decision text" }
                const values = Object.values(item);
                if (values.length > 0 && typeof values[0] === 'string') return (values[0] as string).trim();
                return JSON.stringify(item);
            }
            return String(item);
        })
        .filter(item => item.length > 0 && item !== '[object Object]' && item !== 'null' && item !== 'undefined');
}

/**
 * Parse a structured text delta (fallback when JSON parsing fails)
 */
function parseStructuredDelta(text: string): BlackboardDelta {
    const delta: BlackboardDelta = {
        newConstraints: [],
        decisions: [],
        warnings: []
    };

    const lines = text.split('\n');
    let currentSection: 'constraints' | 'decisions' | 'warnings' | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (/constraint/i.test(trimmed)) {
            currentSection = 'constraints';
            continue;
        }
        if (/decision/i.test(trimmed)) {
            currentSection = 'decisions';
            continue;
        }
        if (/warning/i.test(trimmed)) {
            currentSection = 'warnings';
            continue;
        }

        // Parse list items
        const listMatch = trimmed.match(/^[-*]\s*(.+)$/);
        if (listMatch && currentSection) {
            const item = listMatch[1].trim();
            if (item.length > 0) {
                if (currentSection === 'constraints') {
                    delta.newConstraints.push(item);
                } else if (currentSection === 'decisions') {
                    delta.decisions.push(item);
                } else if (currentSection === 'warnings') {
                    delta.warnings.push(item);
                }
            }
        }
    }

    return delta;
}

// ============================================================================
// SYNCHRONIZATION UTILITIES
// ============================================================================

/**
 * Create a VerifiedBrick from raw data
 */
export function createVerifiedBrick(
    id: string,
    persona: string,
    instruction: string,
    artifact: string,
    delta: BlackboardDelta,
    confidence: number
): VerifiedBrick {
    return {
        id,
        persona,
        instruction,
        artifact,
        delta,
        verifiedAt: Date.now(),
        confidence
    };
}

/**
 * Format context changes for display
 */
export function formatContextChanges(result: DeltaMergeResult): string {
    if (!result.success) {
        return '❌ Delta merge failed';
    }

    let output = '📋 **Blackboard Delta Applied**\n\n';

    if (result.additions.constraints.length > 0) {
        output += '**New Constraints:**\n';
        result.additions.constraints.forEach(c => {
            output += `  + ${c}\n`;
        });
    }

    if (result.additions.decisions.length > 0) {
        output += '**New Decisions:**\n';
        result.additions.decisions.forEach(d => {
            output += `  + ${d}\n`;
        });
    }

    if (result.additions.warnings.length > 0) {
        output += '**New Warnings:**\n';
        result.additions.warnings.forEach(w => {
            output += `  + ⚠️ ${w}\n`;
        });
    }

    if (result.conflicts.length > 0) {
        output += '\n**⚠️ Potential Conflicts:**\n';
        result.conflicts.forEach(c => {
            output += `  - ${c}\n`;
        });
    }

    return output;
}

import { extractWithPreference, safeJsonParse, safeYamlParse } from '../utils/safe-json';

export interface NormalizedBlackboardDelta {
    newConstraints: string[];
    decisions: string[];
    warnings: string[];
}

export interface ArtifactExtractionResult {
    artifact: string;
    trace: string;
    blackboardDelta: NormalizedBlackboardDelta;
    diagnostics: string[];
    envelopeDetected: boolean;
    rejectionDetected: boolean;
}

const EMPTY_DELTA: NormalizedBlackboardDelta = {
    newConstraints: [],
    decisions: [],
    warnings: []
};

const TRIBUNAL_MARKER = /^\s*\[(TRIBUNAL REJECTION|SURVEYOR REFUSAL)\]/i;

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function forceString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item === null || item === undefined) return '';
            try {
                return JSON.stringify(item);
            } catch {
                return String(item);
            }
        })
        .filter((item) => item.length > 0);
}

function coerceDelta(value: unknown): NormalizedBlackboardDelta {
    if (!isRecord(value)) return { ...EMPTY_DELTA };
    return {
        newConstraints: toStringArray(value.newConstraints || value.constraints),
        decisions: toStringArray(value.decisions),
        warnings: toStringArray(value.warnings)
    };
}

function extractEnvelopeObject(
    obj: Record<string, any>
): { artifact?: unknown; trace?: unknown; blackboardDelta?: unknown; envelopeDetected: boolean } {
    const wrapperKeys = ['data', 'payload', 'response', 'result', 'output'];
    const directArtifact =
        obj.repaired_artifact ??
        obj.artifact ??
        (isRecord(obj.repairedArtifact) ? obj.repairedArtifact.content : obj.repairedArtifact);

    if (directArtifact !== undefined) {
        return {
            artifact: directArtifact,
            trace: obj.trace || obj.reasoning,
            blackboardDelta: obj.blackboardDelta || obj.delta,
            envelopeDetected: true
        };
    }

    for (const key of wrapperKeys) {
        const wrapped = obj[key];
        if (!isRecord(wrapped)) continue;
        const nested = extractEnvelopeObject(wrapped);
        if (nested.envelopeDetected) {
            return {
                artifact: nested.artifact,
                trace: nested.trace ?? obj.trace ?? obj.reasoning,
                blackboardDelta: nested.blackboardDelta ?? obj.blackboardDelta ?? obj.delta,
                envelopeDetected: true
            };
        }
    }

    return { envelopeDetected: false };
}

function stripMarkdownCodeFence(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^```(?:json|markdown|md|txt)?\s*([\s\S]*?)\s*```$/i);
    return match ? match[1].trim() : trimmed;
}

function extractProtocolSections(text: string): { trace: string; delta: string; artifact: string; matched: boolean } {
    const traceMatch = text.match(/###\s*TRACE\s*\n([\s\S]*?)(?=###\s*BLACKBOARD DELTA|###\s*ARTIFACT|$)/i);
    const deltaMatch = text.match(/###\s*BLACKBOARD DELTA\s*\n([\s\S]*?)(?=###\s*ARTIFACT|$)/i);
    const artifactMatch = text.match(/###\s*ARTIFACT\s*\n([\s\S]*?)$/i);

    if (!traceMatch && !deltaMatch && !artifactMatch) {
        return { trace: '', delta: '', artifact: text, matched: false };
    }

    return {
        trace: traceMatch ? traceMatch[1].trim() : '',
        delta: deltaMatch ? deltaMatch[1].trim() : '',
        artifact: artifactMatch ? artifactMatch[1].trim() : text.trim(),
        matched: true
    };
}

function decodeCorruptedPunctuation(text: string): string {
    return text
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/‘/g, "'")
        .replace(/’/g, "'")
        .replace(/“/g, '"')
        .replace(/�/g, '"')
        .replace(/…/g, '...')
        .replace(/é/g, 'e')
        .replace(/� /g, 'a')
        .replace(/\u00a0/g, ' ');
}

export function cleanFluentArtifactBody(input: string): string {
    if (!input) return '';

    let text = input.trim();
    if (TRIBUNAL_MARKER.test(text)) return '';

    text = stripMarkdownCodeFence(text);

    const parsedEnvelope = extractWithPreference<any>(text, 'json');
    if (parsedEnvelope.data && isRecord(parsedEnvelope.data)) {
        const extracted = extractEnvelopeObject(parsedEnvelope.data);
        if (extracted.envelopeDetected && extracted.artifact !== undefined) {
            text = forceString(extracted.artifact).trim();
        }
    }

    const protocol = extractProtocolSections(text);
    if (protocol.matched) {
        text = protocol.artifact;
    }

    // Remove leaked protocol artifacts from final reader body.
    text = text
        .replace(/\[TRIBUNAL REJECTION\][^\n]*/gi, '')
        .replace(/\[SURVEYOR REFUSAL\][^\n]*/gi, '')
        .replace(/(^|\n)\s*"?trace"?\s*:\s*/gi, '$1')
        .replace(/(^|\n)\s*"?blackboardDelta"?\s*:\s*/gi, '$1');

    // Remove repeated JSON-fence wrappers left behind after extraction.
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');

    // Keep at most triple newlines for readability.
    text = text.replace(/\n{4,}/g, '\n\n\n');

    return decodeCorruptedPunctuation(text).trim();
}

export function extractArtifactPayload(raw: unknown): ArtifactExtractionResult {
    const result: ArtifactExtractionResult = {
        artifact: '',
        trace: '',
        blackboardDelta: { ...EMPTY_DELTA },
        diagnostics: [],
        envelopeDetected: false,
        rejectionDetected: false
    };

    if (raw === null || raw === undefined) {
        result.diagnostics.push('No artifact payload found.');
        return result;
    }

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (TRIBUNAL_MARKER.test(trimmed)) {
            result.rejectionDetected = true;
            result.diagnostics.push('Rejected output marker detected.');
            return result;
        }

        const envelope = extractWithPreference<any>(trimmed, 'json');
        if (envelope.data && isRecord(envelope.data)) {
            const extracted = extractEnvelopeObject(envelope.data);
            if (extracted.envelopeDetected && extracted.artifact !== undefined) {
                result.envelopeDetected = true;
                result.artifact = cleanFluentArtifactBody(forceString(extracted.artifact));
                result.trace = forceString(extracted.trace);
                result.blackboardDelta = coerceDelta(extracted.blackboardDelta);
                result.diagnostics.push(`Envelope extracted via ${envelope.format || 'json'} parser.`);
                return result;
            }
        }

        const protocol = extractProtocolSections(trimmed);
        if (protocol.matched) {
            result.envelopeDetected = true;
            result.trace = protocol.trace;
            const deltaRaw = stripMarkdownCodeFence(protocol.delta);
            const yamlDelta = safeYamlParse<any>(deltaRaw, null);
            if (yamlDelta.success && yamlDelta.data) {
                result.blackboardDelta = coerceDelta(yamlDelta.data);
            } else {
                const jsonDelta = safeJsonParse<any>(deltaRaw, null);
                if (jsonDelta.success && jsonDelta.data) {
                    result.blackboardDelta = coerceDelta(jsonDelta.data);
                }
            }
            result.artifact = cleanFluentArtifactBody(protocol.artifact);
            result.diagnostics.push('Protocol sections extracted from markdown response.');
            return result;
        }

        result.artifact = cleanFluentArtifactBody(trimmed);
        return result;
    }

    if (isRecord(raw)) {
        const extracted = extractEnvelopeObject(raw);
        if (extracted.envelopeDetected && extracted.artifact !== undefined) {
            result.envelopeDetected = true;
            result.artifact = cleanFluentArtifactBody(forceString(extracted.artifact));
            result.trace = forceString(extracted.trace);
            result.blackboardDelta = coerceDelta(extracted.blackboardDelta);
            result.diagnostics.push('Envelope extracted from object payload.');
            return result;
        }
        result.artifact = cleanFluentArtifactBody(forceString(raw));
        return result;
    }

    result.artifact = cleanFluentArtifactBody(forceString(raw));
    return result;
}

export function hasProtocolLeakage(text: string): boolean {
    if (!text) return false;
    return /(\[TRIBUNAL REJECTION\]|\[SURVEYOR REFUSAL\]|###\s*TRACE|###\s*BLACKBOARD DELTA|"blackboardDelta"\s*:|"trace"\s*:|```json)/i.test(text);
}

/**
 * Turbo Response Parser
 * 
 * Purpose: Parse structured JSON responses from small/turbo models (e.g., gemma3:12b)
 * and extract the components needed by the pipeline.
 * 
 * Small models are instructed to respond ONLY in JSON format:
 * {
 *   "trace": "reasoning about the task...",
 *   "blackboardDelta": {
 *     "newConstraints": [...],
 *     "decisions": [...],
 *     "warnings": [...]
 *   },
 *   "artifact": { ... }  // The actual content (can be any JSON structure)
 * }
 * 
 * This parser extracts:
 * 1. `blackboardDelta` → BlackboardDelta object for the Living Constitution
 * 2. `artifact` → Stringified JSON or markdown for the VerifiedBrick
 * 3. `trace` → Optional reasoning for logging
 * 
 * @module engine/turbo-parser
 * @version V3.0
 */

import { BlackboardDelta } from './specialist';
import { safeJsonParse } from '../utils/safe-json';
import { Leviathan } from './leviathan';

// ============================================================================
// TYPES
// ============================================================================

export interface TurboResponse {
    /** Agent's reasoning/thinking (for logging) */
    trace?: string;

    /** Changes to the Living Constitution */
    blackboardDelta: BlackboardDelta;

    /** The actual content artifact */
    artifact: any;

    /** Raw JSON for debugging */
    raw?: any;
}

export interface TurboParseResult {
    success: boolean;
    response: TurboResponse | null;
    error?: string;

    /** The artifact as a string (for VerifiedBrick) */
    artifactString: string;

    /** Whether the artifact was converted from JSON to string */
    artifactWasJson: boolean;
}

// ============================================================================
// TURBO PARSER
// ============================================================================

/**
 * Parse a JSON response from a turbo/small model
 * 
 * @param rawResponse - The raw text response from the LLM
 * @param options - Parsing options
 * @returns Parsed response with extracted components
 */
export function parseTurboResponse(
    rawResponse: string,
    options: {
        /** If true, stringify the artifact as pretty JSON. If false, try to convert to markdown. */
        keepArtifactAsJson?: boolean;
        /** If true, use aggressive cleaning (Leviathan Centrifuge) */
        useCentrifuge?: boolean;
    } = {}
): TurboParseResult {
    const { keepArtifactAsJson = false, useCentrifuge = true } = options;

    const defaultResult: TurboParseResult = {
        success: false,
        response: null,
        artifactString: '',
        artifactWasJson: false
    };

    if (!rawResponse || typeof rawResponse !== 'string') {
        return { ...defaultResult, error: 'Empty or invalid response' };
    }

    // Step 1: Clean response if needed
    let jsonText = rawResponse;
    if (useCentrifuge) {
        const cleaned = Leviathan.centrifuge(rawResponse);
        if (cleaned.success && cleaned.data) {
            // Already parsed, use directly
            return extractFromParsed(cleaned.data, keepArtifactAsJson);
        }
    }

    // Step 2: Try to parse as JSON
    const parseResult = safeJsonParse(jsonText);
    if (!parseResult.success || !parseResult.data) {
        return { ...defaultResult, error: `JSON parse failed: ${parseResult.error}` };
    }

    return extractFromParsed(parseResult.data, keepArtifactAsJson);
}

/**
 * Extract TurboResponse from a parsed JSON object
 */
function extractFromParsed(data: any, keepArtifactAsJson: boolean): TurboParseResult {
    const defaultResult: TurboParseResult = {
        success: false,
        response: null,
        artifactString: '',
        artifactWasJson: false
    };

    // Extract components
    const trace = data.trace || data.reasoning || '';
    const rawDelta = data.blackboardDelta || data.delta || {};
    const rawArtifact = data.artifact || data.output || data.result || data;

    // Build BlackboardDelta
    const blackboardDelta: BlackboardDelta = {
        newConstraints: ensureStringArray(rawDelta.newConstraints || rawDelta.constraints || []),
        decisions: ensureStringArray(rawDelta.decisions || []),
        warnings: ensureStringArray(rawDelta.warnings || [])
    };

    // Convert artifact to string
    let artifactString: string;
    let artifactWasJson = false;

    if (typeof rawArtifact === 'string') {
        artifactString = rawArtifact;
    } else if (rawArtifact && typeof rawArtifact === 'object') {
        artifactWasJson = true;
        if (keepArtifactAsJson) {
            artifactString = JSON.stringify(rawArtifact, null, 2);
        } else {
            artifactString = convertArtifactToMarkdown(rawArtifact);
        }
    } else {
        artifactString = String(rawArtifact || '');
    }

    return {
        success: true,
        response: {
            trace,
            blackboardDelta,
            artifact: rawArtifact,
            raw: data
        },
        artifactString,
        artifactWasJson
    };
}

/**
 * Convert a JSON artifact to readable markdown
 */
function convertArtifactToMarkdown(artifact: any, depth: number = 0): string {
    if (!artifact || typeof artifact !== 'object') {
        return String(artifact);
    }

    const lines: string[] = [];
    const indent = '  '.repeat(depth);

    // Handle arrays
    if (Array.isArray(artifact)) {
        for (const item of artifact) {
            if (typeof item === 'object') {
                lines.push(convertArtifactToMarkdown(item, depth));
            } else {
                lines.push(`${indent}- ${item}`);
            }
        }
        return lines.join('\n');
    }

    // Handle objects
    for (const [key, value] of Object.entries(artifact)) {
        // Skip internal/meta keys
        if (key.startsWith('_')) continue;

        // Format key as header based on depth
        const headerLevel = Math.min(depth + 2, 6);
        const header = '#'.repeat(headerLevel);

        if (value === null || value === undefined) {
            continue;
        } else if (typeof value === 'string') {
            // Check if it's a long string (description, content, etc.)
            if (value.length > 100 || key === 'description' || key === 'content') {
                lines.push(`${header} ${formatKey(key)}`);
                lines.push('');
                lines.push(value);
                lines.push('');
            } else {
                lines.push(`**${formatKey(key)}:** ${value}`);
            }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            lines.push(`**${formatKey(key)}:** ${value}`);
        } else if (Array.isArray(value)) {
            lines.push(`${header} ${formatKey(key)}`);
            lines.push('');
            if (value.length > 0 && typeof value[0] === 'object') {
                // Array of objects - recursively convert
                for (let i = 0; i < value.length; i++) {
                    lines.push(`### ${i + 1}. ${getItemTitle(value[i], i)}`);
                    lines.push('');
                    lines.push(convertArtifactToMarkdown(value[i], depth + 2));
                    lines.push('');
                }
            } else {
                // Array of primitives
                for (const item of value) {
                    lines.push(`- ${item}`);
                }
            }
            lines.push('');
        } else if (typeof value === 'object') {
            lines.push(`${header} ${formatKey(key)}`);
            lines.push('');
            lines.push(convertArtifactToMarkdown(value, depth + 1));
            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Format a JSON key to human-readable text
 */
function formatKey(key: string): string {
    return key
        .replace(/([A-Z])/g, ' $1')  // camelCase to spaces
        .replace(/_/g, ' ')           // snake_case to spaces
        .replace(/\b\w/g, c => c.toUpperCase())  // Capitalize
        .trim();
}

/**
 * Get a title for an array item
 */
function getItemTitle(item: any, index: number): string {
    if (typeof item !== 'object') return `Item ${index + 1}`;

    // Try common title fields
    const titleFields = ['name', 'title', 'id', 'label', 'heading'];
    for (const field of titleFields) {
        if (item[field] && typeof item[field] === 'string') {
            return item[field];
        }
    }

    return `Item ${index + 1}`;
}

/**
 * Ensure an array contains only strings
 */
function ensureStringArray(arr: any): string[] {
    if (!Array.isArray(arr)) return [];

    return arr
        .map(item => {
            if (typeof item === 'string') return item.trim();
            if (typeof item === 'number') return String(item);
            if (item && typeof item === 'object') {
                // Try to extract text content
                const values = Object.values(item);
                if (values.length > 0 && typeof values[0] === 'string') {
                    return (values[0] as string).trim();
                }
                return JSON.stringify(item);
            }
            return String(item);
        })
        .filter(item => item.length > 0 && item !== 'null' && item !== 'undefined');
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick parse for turbo responses - returns artifact string directly
 */
export function extractTurboArtifact(rawResponse: string, asJson: boolean = false): string {
    const result = parseTurboResponse(rawResponse, { keepArtifactAsJson: asJson });
    return result.artifactString;
}

/**
 * Quick parse for turbo responses - returns delta directly
 */
export function extractTurboDelta(rawResponse: string): BlackboardDelta {
    const result = parseTurboResponse(rawResponse);
    if (result.success && result.response) {
        return result.response.blackboardDelta;
    }
    return { newConstraints: [], decisions: [], warnings: [] };
}

/**
 * Check if a response looks like a turbo JSON response
 */
export function isTurboResponse(rawResponse: string): boolean {
    if (!rawResponse || typeof rawResponse !== 'string') return false;

    const trimmed = rawResponse.trim();
    if (!trimmed.startsWith('{')) return false;

    // Quick check for expected fields
    return (
        trimmed.includes('"artifact"') ||
        trimmed.includes('"blackboardDelta"') ||
        trimmed.includes('"trace"')
    );
}

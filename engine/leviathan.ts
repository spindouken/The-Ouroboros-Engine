
/**
 * LEVIATHAN MIDDLEWARE
 * 
 * "The Doppler Sandwich" Protocol + "The Centrifuge" Post-Processor
 * 
 * Problem: Small models (4B/8B/12B) suffer from "Context Amnesia" and "Instruction Drift".
 * They process the 5k token prompt but forget the constraints by the time they reach the end.
 * Even with `json_object` mode, they can bleed markdown or add preambles.
 * 
 * Solution: 
 * 1. SANDWICH: Mechanically repeat the critical constraints at the END of the prompt.
 * 2. CENTRIFUGE: Post-process responses to aggressively extract JSON, stripping all noise.
 * 
 * Usage:
 * const enhancedPrompt = Leviathan.sandwich(originalPrompt);
 * const cleanJson = Leviathan.centrifuge(rawResponse);
 */

import { safeJsonParse, SafeJsonResult } from '../utils/safe-json';

export interface LeviathanExtractionResult<T = any> {
    success: boolean;
    data: T | null;
    error?: string;
    cleaned?: boolean;       // True if cleaning was applied
    extractionMethod?: string;
    rawLength?: number;      // Original response length
    cleanedLength?: number;  // Cleaned response length
}

export class Leviathan {

    // The "Anchor" - Critical constraints that must never be ignored.
    private static readonly ANCHORS = [
        "CRITICAL: RETURN ONLY JSON.",
        "DO NOT OUTPUT MARKDOWN.",
        "NO PREAMBLE OR EXPLANATION.",
        "START WITH { OR [ AND END WITH } OR ]."
    ];

    // Common preamble patterns that small models output before JSON
    private static readonly PREAMBLE_PATTERNS = [
        /^Here(?:'s| is| are)?\s*(?:the|your|my)?\s*(?:JSON|response|output|result|data)?\s*[:.]?\s*/i,
        /^(?:Sure|OK|Okay|Certainly|Of course)[,!.]?\s*(?:Here(?:'s| is)?)?\s*/i,
        /^(?:I |Let me |I'll |I will )\s*(?:provide|generate|create|output)\s*/i,
        /^(?:The )?(?:JSON|response|output|result) (?:is|would be|follows)[:.]?\s*/i,
        /^(?:Based on|According to|As requested)[^{[]*?(?=[\[{])/i,
        /^```(?:json)?\s*/i,  // Opening markdown block
    ];

    // Common postamble patterns that small models append after JSON
    private static readonly POSTAMBLE_PATTERNS = [
        /\s*```\s*$/,  // Closing markdown block
        /\s*(?:Let me know|Hope this helps|Is there anything|Feel free)[^}]*$/i,
        /\s*(?:Note:|Please note:?|Important:?)[^}]*$/i,
        /\s*(?:This JSON|The above|This response)[^}]*$/i,
    ];

    /**
     * "The Doppler Sandwich"
     * Wraps the prompt in a stiff layer of constraints.
     * Enhanced with explicit JSON structure reminders.
     */
    public static sandwich(prompt: string): string {
        const head = `=== CRITICAL INSTRUCTIONS ===
${this.ANCHORS.join('\n')}

=== YOUR TASK ===
`;
        const tail = `

=== REMINDER (READ THIS AGAIN) ===
${this.ANCHORS.join(' ')}
YOUR OUTPUT MUST BE VALID JSON. NO MARKDOWN. NO EXPLANATION. ONLY JSON.`;

        return `${head}${prompt}${tail}`;
    }

    /**
     * "The Centrifuge" - Post-processing extractor for small model responses
     * 
     * Aggressively cleans and extracts JSON from chatty model output.
     * This is the PRIMARY extraction point for small/turbo engine responses.
     * 
     * Cleaning Pipeline:
     * 1. Trim whitespace
     * 2. Remove known preamble patterns
     * 3. Remove known postamble patterns
     * 4. Strip markdown code block fences (if present)
     * 5. Attempt brace/bracket extraction
     * 6. Final JSON parse validation
     * 
     * @param response - Raw LLM response text
     * @param defaultValue - Value to return if extraction fails
     * @returns Extracted and validated JSON data
     */
    public static centrifuge<T = any>(response: string, defaultValue: T | null = null): LeviathanExtractionResult<T> {
        const rawLength = response?.length || 0;

        if (!response || typeof response !== 'string') {
            return {
                success: false,
                data: defaultValue,
                error: 'Empty or invalid response',
                cleaned: false,
                rawLength: 0,
                cleanedLength: 0
            };
        }

        let text = response.trim();

        // Step 1: Quick check - is it already clean JSON?
        const quickResult = safeJsonParse<T>(text, null);
        if (quickResult.success && quickResult.extractionMethod === 'raw') {
            return {
                success: true,
                data: quickResult.data,
                cleaned: false,
                extractionMethod: 'raw',
                rawLength,
                cleanedLength: text.length
            };
        }

        // Step 2: Apply aggressive cleaning
        let cleaned = text;
        let wasCleaned = false;

        // Remove preambles
        for (const pattern of this.PREAMBLE_PATTERNS) {
            const before = cleaned;
            cleaned = cleaned.replace(pattern, '');
            if (before !== cleaned) wasCleaned = true;
        }

        // Remove postambles
        for (const pattern of this.POSTAMBLE_PATTERNS) {
            const before = cleaned;
            cleaned = cleaned.replace(pattern, '');
            if (before !== cleaned) wasCleaned = true;
        }

        cleaned = cleaned.trim();

        // Step 3: Handle double-wrapped JSON (rare but possible)
        // e.g., {"result": "{ \"actual\": \"data\" }"}
        if (cleaned.includes('\\"') && !cleaned.includes('":"')) {
            // This might be escaped JSON inside a string, try to unescape
            try {
                const outer = JSON.parse(cleaned);
                if (typeof outer === 'object' && outer !== null) {
                    // Check if any value is a stringified JSON
                    for (const key of Object.keys(outer)) {
                        if (typeof outer[key] === 'string' && (outer[key].startsWith('{') || outer[key].startsWith('['))) {
                            try {
                                const inner = JSON.parse(outer[key]);
                                return {
                                    success: true,
                                    data: inner as T,
                                    cleaned: true,
                                    extractionMethod: 'nested_json',
                                    rawLength,
                                    cleanedLength: outer[key].length
                                };
                            } catch {
                                // Not actually nested, continue
                            }
                        }
                    }
                }
            } catch {
                // Not valid JSON, continue with cleaning
            }
        }

        // Step 4: Use safeJsonParse on cleaned text
        const cleanedResult = safeJsonParse<T>(cleaned, null);
        if (cleanedResult.success) {
            return {
                success: true,
                data: cleanedResult.data,
                cleaned: wasCleaned,
                extractionMethod: cleanedResult.extractionMethod,
                rawLength,
                cleanedLength: cleaned.length
            };
        }

        // Step 5: Last resort - find first { or [ and extract to matching brace
        const jsonStart = cleaned.search(/[\[{]/);
        if (jsonStart > 0) {
            const extracted = cleaned.substring(jsonStart);
            const extractedResult = safeJsonParse<T>(extracted, null);
            if (extractedResult.success) {
                return {
                    success: true,
                    data: extractedResult.data,
                    cleaned: true,
                    extractionMethod: 'prefix_stripped_' + extractedResult.extractionMethod,
                    rawLength,
                    cleanedLength: extracted.length
                };
            }
        }

        // Step 6: Complete failure
        return {
            success: false,
            data: defaultValue,
            error: `JSON extraction failed. Raw text (first 200 chars): ${response.substring(0, 200)}`,
            cleaned: wasCleaned,
            rawLength,
            cleanedLength: cleaned.length
        };
    }

    /**
     * Combined processing for small/turbo models
     * 
     * @param response - Raw LLM response text
     * @param defaultValue - Value to return if extraction fails
     * @returns Clean JSON data or default
     */
    public static extract<T = any>(response: string, defaultValue: T | null = null): T | null {
        const result = this.centrifuge<T>(response, defaultValue);
        return result.data;
    }

    /**
     * Strict extraction with validation and logging
     * Useful for debugging extraction issues
     */
    public static extractWithDiagnostics<T = any>(response: string, context?: string): LeviathanExtractionResult<T> {
        const result = this.centrifuge<T>(response, null);

        if (!result.success) {
            console.warn(`[Leviathan:${context || 'unknown'}] Extraction failed:`, {
                rawLength: result.rawLength,
                cleanedLength: result.cleanedLength,
                error: result.error,
                preview: response.substring(0, 300)
            });
        } else if (result.cleaned) {
            console.log(`[Leviathan:${context || 'unknown'}] Cleaned extraction:`, {
                method: result.extractionMethod,
                rawLength: result.rawLength,
                cleanedLength: result.cleanedLength,
                savings: `${Math.round((1 - (result.cleanedLength! / result.rawLength!)) * 100)}%`
            });
        }

        return result;
    }

    /**
     * Wraps a system prompt for small models to enforce Persona retention.
     */
    public static enforcePersona(persona: string): string {
        return `${persona}\n\n(Stay in character. Do not break the fourth wall. Output only JSON.)`;
    }

    /**
     * Validates that a string is valid JSON without parsing it fully
     * Quick validation for pre-checks
     */
    public static isValidJson(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) return false;

        // Quick structural check
        const startsValid = trimmed.startsWith('{') || trimmed.startsWith('[');
        const endsValid = trimmed.endsWith('}') || trimmed.endsWith(']');

        if (!startsValid || !endsValid) return false;

        try {
            JSON.parse(trimmed);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Safe JSON Parsing Utility (The Hydra's Digestive System)
 * 
 * Implements the "Hybrid Extraction" (Markdown + Braces) standard
 * for parsing LLM responses into valid JSON.
 * 
 * V2.99 Soft-Strict Protocol: Also supports YAML extraction
 * 
 * Priority: Local parsing FIRST (prevents API-induced data malformation)
 * 
 * @module utils/safe-json
 * @version V2.99
 */

import yaml from 'js-yaml';

export interface SafeJsonResult<T = any> {
    success: boolean;
    data: T | null;
    error?: string;
    extractionMethod?: 'markdown_json' | 'markdown_block' | 'markdown_yaml' | 'markdown_yml' | 'braces' | 'brackets' | 'raw';
}

/**
 * YAML Extraction Result (For Soft-Strict Protocol V2.99)
 * Supports "Think then Commit" pattern where agents write Markdown then commit YAML
 */
export interface SafeYamlResult<T = any> {
    success: boolean;
    data: T | null;
    error?: string;
    extractionMethod?: 'markdown_yaml' | 'markdown_yml' | 'markdown_block' | 'raw_yaml';
}

/**
 * Hybrid JSON Extraction Strategies (in priority order):
 * 1. Markdown JSON block: ```json...```
 * 2. Generic Markdown block: ```...```
 * 3. Curly braces: {...}
 * 4. Square brackets: [...]
 * 5. Raw parse attempt
 */

const EXTRACTION_STRATEGIES = [
    {
        name: 'markdown_json' as const,
        pattern: /```json\s*([\s\S]*?)\s*```/,
        description: 'JSON fenced code block'
    },
    {
        name: 'markdown_block' as const,
        pattern: /```\s*([\s\S]*?)\s*```/,
        description: 'Generic fenced code block'
    }
];

/**
 * Attempts to clean common LLM JSON formatting issues
 */
function sanitizeJsonString(str: string): string {
    // Remove BOM and zero-width characters
    let cleaned = str.replace(/[\uFEFF\u200B-\u200D\uFFFE\uFFFF]/g, '');

    // Trim whitespace
    cleaned = cleaned.trim();

    // Handle trailing commas (common LLM mistake)
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Handle unescaped newlines in strings (replace with \n)
    // This is tricky and can break valid JSON, so we're conservative

    return cleaned;
}

/**
 * Extract JSON object from text using brace matching
 */
function extractByBraces(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return text.substring(start, i + 1);
                }
            }
        }
    }

    // Fallback: simple substring (last resort)
    const end = text.lastIndexOf('}');
    if (end > start) {
        return text.substring(start, end + 1);
    }

    return null;
}

/**
 * Extract JSON array from text using bracket matching
 */
function extractByBrackets(text: string): string | null {
    const start = text.indexOf('[');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '[') depth++;
            else if (char === ']') {
                depth--;
                if (depth === 0) {
                    return text.substring(start, i + 1);
                }
            }
        }
    }

    // Fallback: simple substring
    const end = text.lastIndexOf(']');
    if (end > start) {
        return text.substring(start, end + 1);
    }

    return null;
}

/**
 * Parse JSON safely with multiple extraction strategies
 * 
 * @param text - Raw LLM response text
 * @param defaultValue - Value to return if parsing fails
 * @returns SafeJsonResult with parsed data or error
 */
export function safeJsonParse<T = any>(text: string, defaultValue: T | null = null): SafeJsonResult<T> {
    if (!text || typeof text !== 'string') {
        return {
            success: false,
            data: defaultValue,
            error: 'Input is not a valid string'
        };
    }

    const sanitized = sanitizeJsonString(text);

    // Strategy 1 & 2: Markdown code blocks
    for (const strategy of EXTRACTION_STRATEGIES) {
        const match = sanitized.match(strategy.pattern);
        if (match && match[1]) {
            try {
                const data = JSON.parse(sanitizeJsonString(match[1]));
                return {
                    success: true,
                    data: data as T,
                    extractionMethod: strategy.name
                };
            } catch {
                // Continue to next strategy
            }
        }
    }

    // Strategy 3: Brace extraction (objects)
    const braceExtracted = extractByBraces(sanitized);
    if (braceExtracted) {
        try {
            const data = JSON.parse(braceExtracted);
            return {
                success: true,
                data: data as T,
                extractionMethod: 'braces'
            };
        } catch {
            // Continue to next strategy
        }
    }

    // Strategy 4: Bracket extraction (arrays)
    const bracketExtracted = extractByBrackets(sanitized);
    if (bracketExtracted) {
        try {
            const data = JSON.parse(bracketExtracted);
            return {
                success: true,
                data: data as T,
                extractionMethod: 'brackets'
            };
        } catch {
            // Continue to next strategy
        }
    }

    // Strategy 5: Raw parse (last resort)
    try {
        const data = JSON.parse(sanitized);
        return {
            success: true,
            data: data as T,
            extractionMethod: 'raw'
        };
    } catch (err: any) {
        return {
            success: false,
            data: defaultValue,
            error: `JSON parse failed: ${err.message}`
        };
    }
}

/**
 * Parse JSON for arrays specifically
 * Convenience wrapper that ensures array output
 */
export function safeJsonParseArray<T = any>(text: string): SafeJsonResult<T[]> {
    const result = safeJsonParse<T[]>(text, []);

    if (result.success && !Array.isArray(result.data)) {
        return {
            success: false,
            data: [],
            error: 'Parsed result is not an array'
        };
    }

    return result;
}

/**
 * Parse JSON for objects specifically
 * Convenience wrapper that ensures object output
 */
export function safeJsonParseObject<T extends object = object>(text: string): SafeJsonResult<T> {
    const result = safeJsonParse<T>(text, null);

    if (result.success && (typeof result.data !== 'object' || result.data === null || Array.isArray(result.data))) {
        return {
            success: false,
            data: null,
            error: 'Parsed result is not an object'
        };
    }

    return result;
}

/**
 * Legacy compatibility: Returns parsed JSON or default value
 * Use this as a drop-in replacement for JSON.parse in try-catch blocks
 */
export function extractJson<T = any>(text: string, defaultValue: T | null = null): T | null {
    const result = safeJsonParse<T>(text, defaultValue);
    return result.data;
}

// ============================================================================
// YAML EXTRACTION (Soft-Strict Protocol V2.99)
// ============================================================================

/**
 * YAML Extraction Strategies (in priority order):
 * 1. Markdown YAML block: ```yaml...```
 * 2. Markdown YML block: ```yml...```
 * 3. Raw YAML detection (lines with key: value patterns)
 */
const YAML_EXTRACTION_STRATEGIES = [
    {
        name: 'markdown_yaml' as const,
        pattern: /```yaml\s*([\s\S]*?)\s*```/i,
        description: 'YAML fenced code block'
    },
    {
        name: 'markdown_yml' as const,
        pattern: /```yml\s*([\s\S]*?)\s*```/i,
        description: 'YML fenced code block'
    },
    {
        name: 'markdown_block' as const,
        pattern: /```\s*([\s\S]*?)\s*```/,
        description: 'Generic fenced code block'
    }
];

/**
 * Parse YAML text using js-yaml library
 * 
 * Full YAML 1.2 spec support including:
 * - Multi-level nested structures
 * - Anchors and aliases
 * - Flow syntax
 * - All data types
 * 
 * Uses safe schema (no arbitrary code execution)
 */
function parseYamlText(yamlText: string): any {
    try {
        // Use safe load to prevent arbitrary code execution
        const result = yaml.load(yamlText, {
            schema: yaml.JSON_SCHEMA  // Strict JSON-compatible schema for safety
        });
        return result;
    } catch (err: any) {
        // Try with default schema (more permissive) as fallback
        try {
            return yaml.load(yamlText);
        } catch (fallbackErr: any) {
            throw new Error(`YAML parse error: ${fallbackErr.message || fallbackErr}`);
        }
    }
}

/**
 * Extract and parse YAML from LLM response text
 * 
 * Implements the "Think then Commit" extraction pattern:
 * Look for ```yaml or ```yml blocks at the end of responses
 * 
 * @param text - Raw LLM response text
 * @param defaultValue - Value to return if parsing fails
 * @returns SafeYamlResult with parsed data or error
 */
export function safeYamlParse<T = any>(text: string, defaultValue: T | null = null): SafeYamlResult<T> {
    if (!text || typeof text !== 'string') {
        return {
            success: false,
            data: defaultValue,
            error: 'Input is not a valid string'
        };
    }

    // Try YAML extraction strategies
    for (const strategy of YAML_EXTRACTION_STRATEGIES) {
        const match = text.match(strategy.pattern);
        if (match && match[1]) {
            try {
                const yamlContent = match[1].trim();
                const data = parseYamlText(yamlContent);
                return {
                    success: true,
                    data: data as T,
                    extractionMethod: strategy.name
                };
            } catch (err: any) {
                // Continue to next strategy
                console.warn(`[safeYamlParse] ${strategy.name} extraction failed:`, err.message);
            }
        }
    }

    // Fallback: Try to parse as raw YAML (content looks like key: value lines)
    const yamlLikePattern = /^[\w\-_]+:\s*.+$/m;
    if (yamlLikePattern.test(text)) {
        try {
            const data = parseYamlText(text);
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                return {
                    success: true,
                    data: data as T,
                    extractionMethod: 'raw_yaml'
                };
            }
        } catch {
            // Fall through to error
        }
    }

    return {
        success: false,
        data: defaultValue,
        error: 'YAML extraction failed: No valid YAML block found'
    };
}

/**
 * Extract YAML from text - convenience wrapper
 * Try YAML first, fall back to JSON if that fails
 * 
 * This is the primary extraction method for the Soft-Strict Protocol
 * 
 * @param text - Raw LLM response text
 * @param defaultValue - Value to return if all parsing fails
 * @returns Parsed data or default value
 */
export function extractYamlOrJson<T = any>(text: string, defaultValue: T | null = null): T | null {
    // Try YAML first (preferred in Soft-Strict Protocol)
    const yamlResult = safeYamlParse<T>(text, null);
    if (yamlResult.success && yamlResult.data !== null) {
        return yamlResult.data;
    }

    // Fall back to JSON
    const jsonResult = safeJsonParse<T>(text, defaultValue);
    return jsonResult.data;
}

/**
 * Extract YAML specifically (no JSON fallback)
 * 
 * @param text - Raw LLM response text
 * @param defaultValue - Value to return if parsing fails
 * @returns Parsed YAML data or default value
 */
export function extractYaml<T = any>(text: string, defaultValue: T | null = null): T | null {
    const result = safeYamlParse<T>(text, defaultValue);
    return result.data;
}

/**
 * Dual extraction with preference flag
 * 
 * Used by UnifiedLLMClient to support both YAML (preferred) and JSON (fallback)
 * in the Soft-Strict Protocol
 * 
 * @param text - Raw LLM response text
 * @param preferredFormat - Which format to try first ('yaml' | 'json')
 * @param defaultValue - Value to return if all parsing fails
 * @returns Object with parsed data and the format that succeeded
 */
export function extractWithPreference<T = any>(
    text: string,
    preferredFormat: 'yaml' | 'json' = 'yaml',
    defaultValue: T | null = null
): { data: T | null; format: 'yaml' | 'json' | null } {
    if (preferredFormat === 'yaml') {
        const yamlResult = safeYamlParse<T>(text, null);
        if (yamlResult.success && yamlResult.data !== null) {
            return { data: yamlResult.data, format: 'yaml' };
        }
        const jsonResult = safeJsonParse<T>(text, defaultValue);
        if (jsonResult.success) {
            return { data: jsonResult.data, format: 'json' };
        }
    } else {
        const jsonResult = safeJsonParse<T>(text, null);
        if (jsonResult.success && jsonResult.data !== null) {
            return { data: jsonResult.data, format: 'json' };
        }
        const yamlResult = safeYamlParse<T>(text, defaultValue);
        if (yamlResult.success) {
            return { data: yamlResult.data, format: 'yaml' };
        }
    }

    return { data: defaultValue, format: null };
}

export default {
    safeJsonParse,
    safeJsonParseArray,
    safeJsonParseObject,
    extractJson,
    safeYamlParse,
    extractYaml,
    extractYamlOrJson,
    extractWithPreference
};

/**
 * The Blackboard Surveyor (The Fast Gate) - Section 4.3
 * 
 * Role: The Cheap "Sanity Check" before expensive compute
 * 
 * This is a STRICTLY regex/code-based filter with ZERO LLM cost.
 * It scans for "Red Flags" that indicate low-quality output that would
 * waste expensive Antagonist compute.
 * 
 * Red Flags Detected:
 * 1. Hedging Language: "I think", "Maybe", "It depends", "Possibly"
 * 2. Formatting Issues: Broken JSON, missing ### ARTIFACT blocks
 * 3. Refusals: "I cannot do that", "As an AI", "I'm not able to"
 * 4. Runaway Loops: Token count > 3,000 (indicates repetition or failure to converge)
 * 
 * Outcome: Immediate Discard & Retry ($0 Cost)
 */

import { type ProjectMode } from './genesis-protocol';

// ============================================================================
// TYPES
// ============================================================================

export type SurveyorRedFlagType =
    | 'hedging_language'
    | 'broken_json'
    | 'missing_artifact'
    | 'ai_refusal'
    | 'runaway_loop'
    | 'empty_output'
    | 'conversational_fluff'
    | 'code_generation'
    | 'mode_specific';

export interface SurveyorRedFlag {
    /** Type of red flag detected */
    type: SurveyorRedFlagType;

    /** Human-readable description of the issue */
    message: string;

    /** The specific pattern or content that triggered the flag */
    match: string;

    /** Severity: 'discard' = immediate rejection, 'warn' = log but proceed */
    severity: 'discard' | 'warn';
}

export interface SurveyorResult {
    /** Whether the output passed all checks */
    passed: boolean;

    /** List of red flags detected */
    redFlags: SurveyorRedFlag[];

    /** Recommendation: 'proceed', 'retry', 'split_task' */
    recommendation: 'proceed' | 'retry' | 'split_task';

    /** Token count of the artifact */
    tokenCount: number;

    /** Brief summary for logging */
    summary: string;

    /** V2.99: Whether implementation code was detected (NOT A CODING AGENT) */
    hasImplementationCode?: boolean;

    /** V2.99: Specific code patterns detected */
    codeWarnings?: { pattern: string; severity: string }[];
}

export interface SurveyorConfig {
    /** Maximum token count before flagging as runaway (default: 3000) */
    maxTokenCount: number;

    /** Minimum artifact length (default: 10) */
    minArtifactLength: number;

    /** Whether to flag conversational fluff (default: true) */
    flagConversationalFluff: boolean;

    /** Whether to flag code generation (default: true, this is NOT a coding agent) */
    flagCodeGeneration: boolean;
}

// ============================================================================
// RED FLAG PATTERNS
// ============================================================================

/** Hedging language patterns - indicate uncertainty */
const HEDGING_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bI think\b/gi, name: 'I think' },
    { pattern: /\bmaybe\b/gi, name: 'maybe' },
    { pattern: /\bit depends\b/gi, name: 'it depends' },
    { pattern: /\bpossibly\b/gi, name: 'possibly' },
    { pattern: /\bperhaps\b/gi, name: 'perhaps' },
    { pattern: /\bprobably\b/gi, name: 'probably' },
    { pattern: /\bit seems\b/gi, name: 'it seems' },
    { pattern: /\bmight be\b/gi, name: 'might be' },
    { pattern: /\bcould be\b/gi, name: 'could be' },
    { pattern: /\bI believe\b/gi, name: 'I believe' },
    { pattern: /\bI'm not sure\b/gi, name: "I'm not sure" },
    { pattern: /\bI would guess\b/gi, name: 'I would guess' }
];

/** AI refusal patterns - indicate model refusing to help */
const REFUSAL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bI cannot do that\b/gi, name: 'I cannot do that' },
    { pattern: /\bAs an AI\b/gi, name: 'As an AI' },
    { pattern: /\bI'm not able to\b/gi, name: "I'm not able to" },
    { pattern: /\bI can't help with\b/gi, name: "I can't help with" },
    { pattern: /\bI am unable to\b/gi, name: 'I am unable to' },
    { pattern: /\bI'm sorry,? but I\b/gi, name: "I'm sorry but I" },
    { pattern: /\bI cannot assist\b/gi, name: 'I cannot assist' },
    { pattern: /\bI don't have the ability\b/gi, name: "I don't have the ability" },
    { pattern: /\bI am not programmed\b/gi, name: 'I am not programmed' },
    { pattern: /\bI must decline\b/gi, name: 'I must decline' },
    { pattern: /\bI'm an AI language model\b/gi, name: "I'm an AI language model" },
    { pattern: /\bas a language model\b/gi, name: 'as a language model' }
];

/** Conversational fluff patterns - indicate non-atomic output */
const CONVERSATIONAL_FLUFF_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /^(Here's|Here is) (what|the|a|my)/i, name: "Here's what..." },
    { pattern: /^Based on (the|your|these) requirements/i, name: 'Based on requirements...' },
    { pattern: /^Let me (explain|describe|outline|create)/i, name: 'Let me explain...' },
    { pattern: /^I've (created|designed|developed|prepared)/i, name: "I've created..." },
    { pattern: /^(Certainly|Sure|Of course|Absolutely)(!|,|\.)?\s/i, name: 'Affirmative opener' },
    { pattern: /\bLet me know if you (need|have|want)\b/gi, name: 'Let me know if...' },
    { pattern: /\bFeel free to (ask|reach|contact)\b/gi, name: 'Feel free to...' },
    { pattern: /\bIs there anything else\b/gi, name: 'Is there anything else...' },
    { pattern: /\bHope this helps\b/gi, name: 'Hope this helps' },
    { pattern: /\bHappy to (help|assist|answer)\b/gi, name: 'Happy to help' }
];

/** Code generation patterns - NOT a coding agent, should not generate implementation code */
const CODE_GENERATION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    // Multi-line code blocks with common programming languages
    { pattern: /```(javascript|typescript|python|java|csharp|cpp|go|rust|ruby|php|swift|kotlin)\n[\s\S]{200,}```/gi, name: 'Large code block' },
    // Function definitions in various languages (substantial implementations, not pseudocode)
    { pattern: /\b(function|const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/gi, name: 'Arrow function definition' },
    { pattern: /\bdef\s+\w+\s*\([^)]*\):\s*\n(?:\s+.+\n){10,}/gi, name: 'Python function (10+ lines)' },
    { pattern: /\bpublic\s+(static\s+)?(void|int|string|bool)\s+\w+\s*\(/gi, name: 'Java/C# method' }
];

/**
 * Enhanced implementation code patterns (V2.99 - NOT A CODING AGENT)
 * These patterns indicate implementation code that should be architectural specs instead
 * If detected, flag for review - we're generating architecture, not code
 */
const IMPLEMENTATION_CODE_PATTERNS: Array<{ pattern: RegExp; name: string; severity: 'warn' | 'discard' }> = [
    // Import statements
    { pattern: /^import\s+[\w{},\s]+\s+from\s+['"]/gm, name: 'import_statement', severity: 'warn' },
    { pattern: /^const\s+\w+\s*=\s*require\s*\(/gm, name: 'require_statement', severity: 'warn' },

    // Function/class definitions (implementation, not specs)
    { pattern: /^(export\s+)?(async\s+)?function\s+\w+\s*\(/gm, name: 'function_definition', severity: 'warn' },
    { pattern: /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\([^)]*\)\s*=>/gm, name: 'arrow_function', severity: 'warn' },
    { pattern: /^(export\s+)?class\s+\w+/gm, name: 'class_definition', severity: 'warn' },
    { pattern: /^def\s+\w+\s*\(/gm, name: 'python_function', severity: 'warn' },

    // Code blocks with implementation languages containing actual code
    { pattern: /```(javascript|typescript|python|java|csharp|go|rust|php|ruby|swift|kotlin)\n[\s\S]*?(const|let|var|function|def|class|import|from)\s/gi, name: 'code_block_with_impl', severity: 'warn' },

    // Variable declarations that look like implementation
    { pattern: /^(const|let|var)\s+\w+\s*=\s*(await\s+)?\w+\(/gm, name: 'variable_with_call', severity: 'warn' },
];

/**
 * Mode-specific red flag patterns for early quality filtering.
 * Task 16.1 (mode-aware pattern registry).
 */
export const MODE_RED_FLAGS: Record<ProjectMode, Array<{ pattern: RegExp; name: string }>> = {
    software: [
        { pattern: /\b(import|function|class|const\s+\w+\s*=\s*\()/gi, name: 'implementation code' }
    ],
    scientific_research: [
        { pattern: /\b(I believe|obviously|clearly|everyone knows)\b/gi, name: 'opinion language' },
        { pattern: /\b(studies show|research indicates)\b(?![^\n]*\[[^\]]+\])/gi, name: 'uncited claim' }
    ],
    legal_research: [
        { pattern: /\b(you should|I recommend|my advice)\b/gi, name: 'legal advice' },
        { pattern: /\b(the court held|the statute provides)\b(?![^\n]*\d+\s+[A-Z])/gi, name: 'missing citation' }
    ],
    creative_writing: [
        { pattern: /^[A-Z][^.!?]*[.!?]\s+[A-Z][^.!?]*[.!?]/gm, name: 'full prose' }
    ],
    general: []
};

/**
 * Detect mode-specific red flags without invoking any LLM.
 * This helper is used by tests now and by Surveyor integration in Task 17.
 */
export function detectModeSpecificRedFlags(
    artifact: string,
    mode: ProjectMode
): Array<{ name: string; match: string }> {
    const modePatterns = MODE_RED_FLAGS[mode] || MODE_RED_FLAGS.general;
    const matches: Array<{ name: string; match: string }> = [];

    for (const { pattern, name } of modePatterns) {
        pattern.lastIndex = 0;
        const found = pattern.exec(artifact);
        if (found?.[0]) {
            matches.push({ name, match: found[0] });
        }
    }

    return matches;
}

/**
 * Check for implementation code that should be architectural specs
 * V2.99: NOT A CODING AGENT enforcement
 */
function checkForImplementationCode(artifact: string): {
    hasCode: boolean;
    codeFlags: { pattern: string; severity: string }[];
    recommendation: string;
} {
    const codeFlags: { pattern: string; severity: string }[] = [];

    for (const { pattern, name, severity } of IMPLEMENTATION_CODE_PATTERNS) {
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(artifact)) {
            codeFlags.push({ pattern: name, severity });
        }
    }

    const hasCode = codeFlags.length > 0;
    const recommendation = hasCode
        ? 'Output contains implementation code. Ouroboros should generate SPECIFICATIONS, not code. Consider rephrasing as architectural documentation.'
        : '';

    return { hasCode, codeFlags, recommendation };
}

// ============================================================================
// BLACKBOARD SURVEYOR CLASS
// ============================================================================

export class BlackboardSurveyor {
    private config: SurveyorConfig;

    constructor(config?: Partial<SurveyorConfig>) {
        this.config = {
            maxTokenCount: config?.maxTokenCount ?? 3000,
            minArtifactLength: config?.minArtifactLength ?? 10,
            flagConversationalFluff: config?.flagConversationalFluff ?? true,
            flagCodeGeneration: config?.flagCodeGeneration ?? true
        };
    }

    /**
     * Survey the output for red flags
     * This is a ZERO-COST operation - entirely regex/code-based
     * 
     * @param artifact - The artifact content to survey
     * @param mode - Project mode for mode-specific pattern checks
     * @param fullResponse - Optional full response (for checking structure)
     * @returns SurveyorResult with pass/fail and detailed flags
     */
    survey(
        artifact: string,
        mode: ProjectMode = 'software',
        fullResponse?: string
    ): SurveyorResult {
        const redFlags: SurveyorRedFlag[] = [];

        // Estimate token count (rough: ~4 chars per token)
        const tokenCount = Math.ceil((artifact?.length || 0) / 4);

        // ========================================================================
        // CHECK 1: Empty or too short output
        // ========================================================================
        if (!artifact || artifact.trim().length < this.config.minArtifactLength) {
            redFlags.push({
                type: 'empty_output',
                message: `Output is empty or too short (< ${this.config.minArtifactLength} chars)`,
                match: artifact?.substring(0, 50) || '[empty]',
                severity: 'discard'
            });
        }

        // ========================================================================
        // CHECK 2: Missing ### ARTIFACT block (if full response provided)
        // ========================================================================
        if (fullResponse && !this.hasArtifactBlock(fullResponse)) {
            redFlags.push({
                type: 'missing_artifact',
                message: 'Response missing required ### ARTIFACT section',
                match: 'Expected: ### ARTIFACT',
                severity: 'discard'
            });
        }

        // ========================================================================
        // CHECK 3: Broken JSON (if artifact appears to be JSON)
        // ========================================================================
        const jsonIssue = this.checkBrokenJson(artifact);
        if (jsonIssue) {
            redFlags.push({
                type: 'broken_json',
                message: 'Artifact contains broken/invalid JSON',
                match: jsonIssue,
                severity: 'discard'
            });
        }

        // ========================================================================
        // CHECK 4: Hedging Language (uncertainty indicators)
        // ========================================================================
        const hedgingFlags = this.checkPatterns(
            artifact,
            HEDGING_PATTERNS,
            'hedging_language',
            'Hedging language detected - output should be definitive',
            'discard',
            3 // Only flag if 3+ matches
        );
        redFlags.push(...hedgingFlags);

        // ========================================================================
        // CHECK 5: AI Refusals
        // ========================================================================
        const refusalFlags = this.checkPatterns(
            artifact,
            REFUSAL_PATTERNS,
            'ai_refusal',
            'AI refusal pattern detected',
            'discard',
            1 // Any single refusal is a red flag
        );
        redFlags.push(...refusalFlags);

        // ========================================================================
        // CHECK 6: Runaway Loop Detection (token count)
        // ========================================================================
        if (tokenCount > this.config.maxTokenCount) {
            redFlags.push({
                type: 'runaway_loop',
                message: `Token count (${tokenCount}) exceeds limit (${this.config.maxTokenCount}). Atomic Bricks should be concise.`,
                match: `${tokenCount} tokens`,
                severity: 'discard'
            });
        }

        // ========================================================================
        // CHECK 7: Conversational Fluff (optional)
        // ========================================================================
        if (this.config.flagConversationalFluff) {
            const fluffFlags = this.checkPatterns(
                artifact,
                CONVERSATIONAL_FLUFF_PATTERNS,
                'conversational_fluff',
                'Conversational fluff detected - ARTIFACT should be pure deliverable',
                'warn', // Warn, don't discard
                2
            );
            redFlags.push(...fluffFlags);
        }

        // ========================================================================
        // CHECK 8: Code Generation (NOT a coding agent)
        // ========================================================================
        if (this.config.flagCodeGeneration) {
            const codeFlags = this.checkPatterns(
                artifact,
                CODE_GENERATION_PATTERNS,
                'code_generation',
                'Substantial implementation code detected - this is NOT a coding agent',
                'warn', // Warn, since pseudocode/examples are allowed
                1
            );
            redFlags.push(...codeFlags);
        }

        // ========================================================================
        // CHECK 9: Enhanced Implementation Code Detection (V2.99 - NOT A CODING AGENT)
        // ========================================================================
        const codeCheck = checkForImplementationCode(artifact);

        if (codeCheck.hasCode) {
            redFlags.push({
                type: 'code_generation',
                severity: 'warn',  // Warn but don't auto-discard (user may want to review)
                message: codeCheck.recommendation,
                match: codeCheck.codeFlags.map(f => f.pattern).join(', ')
            });
        }

        // ========================================================================
        // CHECK 10: Mode-Specific Red Flags
        // ========================================================================
        const modeSpecificFlags = detectModeSpecificRedFlags(artifact, mode);
        for (const modeFlag of modeSpecificFlags) {
            redFlags.push({
                type: 'mode_specific',
                severity: 'warn',
                message: `Mode-specific issue detected (${mode}): ${modeFlag.name}`,
                match: modeFlag.match
            });
        }

        // ========================================================================
        // DETERMINE RESULT
        // ========================================================================
        const discardFlags = redFlags.filter(f => f.severity === 'discard');
        const passed = discardFlags.length === 0;

        let recommendation: 'proceed' | 'retry' | 'split_task' = 'proceed';
        if (!passed) {
            // If runaway loop, recommend splitting the task
            if (discardFlags.some(f => f.type === 'runaway_loop')) {
                recommendation = 'split_task';
            } else {
                recommendation = 'retry';
            }
        }

        const summary = passed
            ? `✅ Surveyor PASSED (${redFlags.length} warnings)`
            : `❌ Surveyor FAILED: ${discardFlags.map(f => f.type).join(', ')}`;

        return {
            passed,
            redFlags,
            recommendation,
            tokenCount,
            summary,
            // V2.99: NOT A CODING AGENT enforcement
            hasImplementationCode: codeCheck.hasCode,
            codeWarnings: codeCheck.codeFlags
        };
    }

    /**
     * Check if response contains the required ### ARTIFACT block
     */
    private hasArtifactBlock(response: string): boolean {
        return /###\s*ARTIFACT/i.test(response);
    }

    /**
     * Check for broken JSON in artifact
     * Returns null if no JSON or JSON is valid, error message if broken
     */
    private checkBrokenJson(artifact: string): string | null {
        // Check if artifact appears to contain JSON
        const jsonBlockMatch = artifact.match(/```json\s*([\s\S]*?)\s*```/);
        const startsWithBrace = artifact.trim().startsWith('{') || artifact.trim().startsWith('[');

        if (!jsonBlockMatch && !startsWithBrace) {
            return null; // No JSON detected
        }

        const jsonStr = jsonBlockMatch ? jsonBlockMatch[1] : artifact.trim();

        try {
            JSON.parse(jsonStr);
            return null; // Valid JSON
        } catch (e) {
            const error = e as Error;
            return `JSON parse error: ${error.message.substring(0, 100)}`;
        }
    }

    /**
     * Check artifact against a set of patterns
     */
    private checkPatterns(
        artifact: string,
        patterns: Array<{ pattern: RegExp; name: string }>,
        flagType: SurveyorRedFlagType,
        message: string,
        severity: 'discard' | 'warn',
        threshold: number
    ): SurveyorRedFlag[] {
        const matches: string[] = [];

        for (const { pattern, name } of patterns) {
            // Reset regex lastIndex
            pattern.lastIndex = 0;
            if (pattern.test(artifact)) {
                matches.push(name);
            }
        }

        if (matches.length >= threshold) {
            return [{
                type: flagType,
                message: `${message} (${matches.length} matches)`,
                match: matches.slice(0, 5).join(', '), // Show first 5 matches
                severity
            }];
        }

        return [];
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<SurveyorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): SurveyorConfig {
        return { ...this.config };
    }
}

// ============================================================================
// STANDALONE SURVEY FUNCTION
// ============================================================================

/**
 * Quick survey function for simple use cases
 * 
 * @param artifact - The artifact to survey
 * @param options - Optional configuration overrides
 * @returns SurveyorResult
 */
export function surveyArtifact(
    artifact: string,
    options?: Partial<SurveyorConfig>
): SurveyorResult {
    const surveyor = new BlackboardSurveyor(options);
    return surveyor.survey(artifact);
}

// ============================================================================
// FORMATTING VALIDATORS
// ============================================================================

/**
 * Validate that output follows the three-part schema
 * Returns issues if format is invalid
 */
export function validateOutputSchema(response: string): {
    valid: boolean;
    hasTrace: boolean;
    hasBlackboardDelta: boolean;
    hasArtifact: boolean;
    issues: string[];
} {
    const hasTrace = /###\s*TRACE/i.test(response);
    const hasBlackboardDelta = /###\s*BLACKBOARD DELTA/i.test(response);
    const hasArtifact = /###\s*ARTIFACT/i.test(response);

    const issues: string[] = [];

    if (!hasArtifact) {
        issues.push('Missing required ### ARTIFACT section');
    }
    if (!hasBlackboardDelta) {
        issues.push('Missing ### BLACKBOARD DELTA section');
    }
    if (!hasTrace) {
        issues.push('Missing ### TRACE section');
    }

    return {
        valid: hasArtifact, // ARTIFACT is the only required section
        hasTrace,
        hasBlackboardDelta,
        hasArtifact,
        issues
    };
}

/**
 * Extract artifact from full response
 */
export function extractArtifact(response: string): string {
    const match = response.match(/###\s*ARTIFACT\s*\n([\s\S]*?)$/i);
    return match ? match[1].trim() : response.trim();
}

/**
 * Count hedging patterns in text
 * Returns count and list of matches
 */
export function countHedgingPatterns(text: string): {
    count: number;
    matches: string[];
} {
    const matches: string[] = [];

    for (const { pattern, name } of HEDGING_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            matches.push(name);
        }
    }

    return { count: matches.length, matches };
}

/**
 * Check if text contains AI refusal patterns
 */
export function hasRefusalPattern(text: string): boolean {
    for (const { pattern } of REFUSAL_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}

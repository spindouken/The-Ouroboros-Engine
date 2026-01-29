/**
 * System Constraints Validator (Section 0)
 * 
 * Enforces the core architectural constraints of the Ouroboros Engine:
 * - "NOT a Coding Agent" - Generates architecture/strategy, NOT implementation code
 * - "Local-First Web Application" - All code runs client-side
 * 
 * @module utils/system-constraints
 * @version V2.99
 */

/**
 * Patterns that indicate implementation code generation request
 * These should be REJECTED in favor of "Project Soul" artifacts
 */
const CODE_GENERATION_PATTERNS = [
    // Direct code requests
    /write (?:me )?(?:the |a )?(?:full |complete )?(?:code|implementation|script)/i,
    /generate (?:the |a )?(?:full |complete )?(?:code|implementation|script)/i,
    /create (?:the |a )?(?:full |complete )?(?:code|implementation|script|file)/i,
    /implement (?:the |this |a )?(?:feature|function|class|component|module)/i,
    /build (?:the |this |a )?(?:feature|function|class|component|module)/i,

    // Specific language requests
    /write (?:me )?(?:a )?(?:python|javascript|typescript|java|c\+\+|rust|go) (?:script|program|code)/i,
    /give me (?:the |a )?(?:working |production )?code/i,

    // File creation with code content
    /create (?:a )?(?:new )?(?:file|\.py|\.js|\.ts|\.java)/i
];

/**
 * Allowed "Project Soul" artifact types
 * The engine CAN generate these types of outputs
 */
export const PROJECT_SOUL_TYPES = [
    'Architecture',
    'Strategy',
    'Research',
    'Methodology',
    'Plans',
    'Specifications',
    'Design Documents',
    'Technical Requirements',
    'API Designs',
    'Data Models',
    'Workflow Diagrams',
    'User Stories',
    'Pseudocode (for illustration)',
    'Security Audits (advisory)',
    'Review Recommendations'
] as const;

export type ProjectSoulType = typeof PROJECT_SOUL_TYPES[number];

export interface ConstraintValidationResult {
    isValid: boolean;
    constraint: 'coding_agent' | 'local_first' | null;
    message: string;
    suggestedReframe?: string;
}

/**
 * Validates that a user request is not asking for implementation code
 * 
 * Per Section 0: "NOT a Coding Agent"
 * - ✅ Generates: Architecture, Strategy, Research, Methodology, Plans ("Project Soul")
 * - ❌ Does NOT generate: Implementation code (JavaScript, Python, etc.)
 * - ✅ May include: Pseudocode or architectural examples for illustration
 * 
 * @param userPrompt - The user's input prompt
 * @returns Validation result with suggested reframe if invalid
 */
export function validateNotCodingAgentConstraint(userPrompt: string): ConstraintValidationResult {
    const normalizedPrompt = userPrompt.toLowerCase();

    // Check for direct code generation patterns
    for (const pattern of CODE_GENERATION_PATTERNS) {
        if (pattern.test(userPrompt)) {
            return {
                isValid: false,
                constraint: 'coding_agent',
                message: 'This request appears to be asking for implementation code. The Ouroboros Engine generates "Project Soul" artifacts (Architecture, Strategy, Plans) rather than implementation code.',
                suggestedReframe: reframeCodeRequest(userPrompt)
            };
        }
    }

    // Additional heuristic: Check for specific file content requests
    if (normalizedPrompt.includes('full code') ||
        normalizedPrompt.includes('complete code') ||
        normalizedPrompt.includes('working code') ||
        normalizedPrompt.includes('production code')) {
        return {
            isValid: false,
            constraint: 'coding_agent',
            message: 'Ouroboros generates architectural plans and strategies, not production code. Consider requesting an implementation plan instead.',
            suggestedReframe: reframeCodeRequest(userPrompt)
        };
    }

    return {
        isValid: true,
        constraint: null,
        message: 'Request is compatible with Project Soul generation.'
    };
}

/**
 * Attempts to reframe a code generation request into an architecture request
 */
function reframeCodeRequest(originalPrompt: string): string {
    // Simple reframing suggestions
    let reframed = originalPrompt;

    reframed = reframed.replace(/write (?:me )?(?:the |a )?(?:full |complete )?code for/i, 'Design the architecture for');
    reframed = reframed.replace(/implement/i, 'Plan the implementation of');
    reframed = reframed.replace(/create (?:the |a )?code/i, 'create an implementation plan');
    reframed = reframed.replace(/build (?:the |a )?/i, 'design ');
    reframed = reframed.replace(/give me (?:the )?code/i, 'give me the architecture plan');

    if (reframed === originalPrompt) {
        // Generic fallback
        return `Design the architecture and implementation strategy for: ${originalPrompt}`;
    }

    return reframed;
}

/**
 * Validates that an output does not contain excessive implementation code
 * 
 * Warns if the output appears to be primarily implementation code
 * rather than architectural documentation
 */
export function validateOutputIsProjectSoul(output: string): ConstraintValidationResult {
    // Count code block lines vs prose lines
    const codeBlockPattern = /```[\s\S]*?```/g;
    const codeBlocks = output.match(codeBlockPattern) || [];

    let codeLines = 0;
    for (const block of codeBlocks) {
        codeLines += block.split('\n').length;
    }

    const totalLines = output.split('\n').length;
    const codeRatio = codeLines / Math.max(totalLines, 1);

    // Warning if more than 70% of output is code
    if (codeRatio > 0.7 && codeLines > 50) {
        return {
            isValid: false,
            constraint: 'coding_agent',
            message: 'Output appears to be primarily implementation code. Consider extracting architectural decisions into the TRACE section.',
            suggestedReframe: undefined
        };
    }

    return {
        isValid: true,
        constraint: null,
        message: 'Output is compatible with Project Soul format.'
    };
}

/**
 * Validates that the system is running in a local-first, client-side context
 * 
 * This is a runtime check that can be called during initialization
 */
export function validateLocalFirstConstraint(): ConstraintValidationResult {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    // Check if IndexedDB is available (required for Dexie.js)
    const hasIndexedDB = typeof indexedDB !== 'undefined';

    if (!isBrowser) {
        return {
            isValid: false,
            constraint: 'local_first',
            message: 'Ouroboros Engine must run in a browser environment. Server-side execution is not supported.',
            suggestedReframe: undefined
        };
    }

    if (!hasIndexedDB) {
        return {
            isValid: false,
            constraint: 'local_first',
            message: 'IndexedDB is required for local data storage. Please use a browser that supports IndexedDB.',
            suggestedReframe: undefined
        };
    }

    return {
        isValid: true,
        constraint: null,
        message: 'Local-first constraints satisfied.'
    };
}

export default {
    validateNotCodingAgentConstraint,
    validateOutputIsProjectSoul,
    validateLocalFirstConstraint,
    PROJECT_SOUL_TYPES
};

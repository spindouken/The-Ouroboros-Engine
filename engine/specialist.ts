/**
 * The Specialist Worker (The Generator) - Section 4.1
 * 
 * Role: The Single-Threaded Expert
 * 
 * The Specialist is focused on ONE atomic task. It receives:
 * - AtomicInstruction: The specific task to complete
 * - LivingConstitution: The current project constraints and context
 * - SkillInjections: Relevant past solutions from the memory system
 * 
 * Output Schema:
 * 1. ### TRACE - Internal chain-of-thought (Hidden)
 * 2. ### BLACKBOARD DELTA - Proposed updates to global rules
 * 3. ### ARTIFACT - The actual content (pure deliverable, no conversational wrapper)
 * 
 * Critical Rules:
 * - If context is missing/ambiguous, output [UNKNOWN] or [CONFLICT]
 * - Output must be direct solution only - NO conversational preamble
 * - This is NOT a coding agent - outputs architecture/strategy/plans only
 */

import { LLMResponse } from './UnifiedLLMClient';
import { safeJsonParse, safeYamlParse } from '../utils/safe-json';
import { getSystemPromptForMode } from './templates/specialist-templates';
import { ProjectMode } from './genesis-protocol';
import { extractArtifactPayload } from './artifact-normalizer';

// ============================================================================
// TYPES
// ============================================================================

export interface SpecialistInput {
    /** The specific atomic task to complete (single action, single deliverable) */
    atomicInstruction: string;

    /** The Living Constitution - project constraints, tech stack, global rules */
    livingConstitution: string;

    /** Skill injections - relevant solved problems from memory system */
    skillInjections: string[];

    /** The specialist's persona/role (e.g., "Auth Architect", "API Designer") */
    persona: string;

    /** Complexity score from Prism (1-10, determines model routing) */
    complexity: number;

    /** Lite Mode: Use simplified prompt for small models */
    isLiteMode?: boolean;

    /** Project mode for domain-specific prompting (Requirements 2.6) */
    mode?: ProjectMode;
}

export interface SpecialistOutput {
    /** Internal chain-of-thought reasoning (hidden from final output) */
    trace: string;

    /** Proposed updates to global rules/constraints */
    blackboardDelta: BlackboardDelta;

    /** The actual deliverable content (pure, no conversational wrapper) */
    artifact: string;

    /** Raw response from LLM for debugging */
    rawResponse: string;

    /** Prompt used for generation (for debug/attempt history) */
    promptUsed?: string;

    /** Whether the specialist indicated unknown/conflict status */
    hasUnknown: boolean;
    hasConflict: boolean;

    /** Model that was actually used */
    modelUsed: string;
}

export interface BlackboardDelta {
    /** New constraints to add to the constitution */
    newConstraints: string[];

    /** Decisions made that affect future agents */
    decisions: string[];

    /** Warnings or notes for downstream agents */
    warnings: string[];
}

export interface SpecialistConfig {
    /** Maximum tokens for the response */
    maxTokens?: number;

    /** Temperature for generation (0-1) */
    temperature?: number;
}

// ============================================================================
// SPECIALIST PROMPT BUILDER
// ============================================================================

/**
 * Builds the specialist prompt following the V2.99 Soft-Strict Protocol
 * Uses "Think then Commit" pattern with YAML for structured output
 */
export function buildSpecialistPrompt(input: SpecialistInput): string {
    // Extract mode from input (Requirements 2.6)
    const mode = input.mode || 'software';
    
    // LITE MODE: Simplified Code Generation Prompt for Small Models
    // V2.99 SPECIALIST LITE MODE (Performance Optimized for Small Models)
    if (input.isLiteMode) {
        // Get mode-specific template for lite mode
        const modeTemplate = getSystemPromptForMode(mode);
        
        return `YOU ARE A HIGH-PERFORMANCE SYSTEM ARCHITECT (LITE MODE).
Your goal is to generate "Project Soul" (Specs, Contracts, Architecture).

${modeTemplate}

**OUTPUT FORMAT:**
Return a single JSON object. No Markdown (except inside the artifact string).

{
  "trace": "Brief internal thought process",
  "blackboardDelta": {
    "newConstraints": [],
    "decisions": [],
    "warnings": []
  },
  "artifact": "THE ACTUAL SPECIFICATION CONTENT"
}

**INPUT CONTEXT:**
${input.livingConstitution}

**YOUR TASK:**
${input.atomicInstruction}`;
    }

    const skillContext = input.skillInjections.length > 0
        ? `
## SKILL INJECTIONS (Related Solved Problems)
${input.skillInjections.map((s, i) => `### Skill ${i + 1}:\n${s}`).join('\n\n')}`
        : '';

    // Get mode-specific system prompt (Requirements 2.6)
    const modeSpecificPrompt = getSystemPromptForMode(mode);

    return `# SPECIALIST WORKER PROTOCOL (V2.99 Soft-Strict)

${modeSpecificPrompt}

---

You are: **${input.persona}**

You are a Single-Threaded Expert focused on ONE atomic task. Your output will be verified by quality gates, so precision is critical.

## THE LIVING CONSTITUTION (Project Constraints)
"""
${input.livingConstitution}
"""

## YOUR ATOMIC INSTRUCTION
"""
${input.atomicInstruction}
"""
${skillContext}

---

## OUTPUT REQUIREMENTS (Soft-Strict Protocol)

You MUST structure your response with EXACTLY three sections:

### TRACE
[Your internal chain-of-thought reasoning. Be thorough but concise. This section is for internal verification only.]

### BLACKBOARD DELTA
[Propose updates to the global project context. Use YAML format for reliability:]
\`\`\`yaml
newConstraints:
  - Any new rules discovered during this task
  - Another constraint if applicable
decisions:
  - Key decisions made that affect future agents
  - Another decision if applicable
warnings:
  - Any concerns or edge cases for downstream agents
\`\`\`

### ARTIFACT
[The actual deliverable. This MUST be:
- A direct solution to the atomic instruction
- Pure content only - NO conversational preamble ("Here's what I created...")
- NO context summaries ("Based on the requirements...")
- NO explanatory prose around the deliverable
- Follow the mode-specific output standards defined above]

---

## CRITICAL DIRECTIVES

1. **REFUSAL DIRECTIVE:** If context is MISSING or AMBIGUOUS, you MUST output:
   - \`[UNKNOWN: <what information is missing>]\` - If you cannot proceed without more info
   - \`[CONFLICT: <describe the contradiction>]\` - If requirements contradict each other
   This triggers a "User Intervention Pause" instead of a hallucinated guess.

2. **ATOMIC OUTPUT:** Your response addresses ONE task with ONE clear deliverable.

3. **PURE DELIVERABLE:** The ARTIFACT section contains ONLY the deliverable. No fluff.

Begin your response now:`;
}

// ============================================================================
// OUTPUT PARSER
// ============================================================================

/**
 * Parses the specialist's raw response into structured output
 * V2.99 Soft-Strict Protocol: YAML-first, JSON-fallback for BLACKBOARD DELTA
 */
export function parseSpecialistOutput(rawResponse: string, modelUsed: string): SpecialistOutput {
    const normalized = extractArtifactPayload(rawResponse);

    let trace = normalized.trace || '';
    let artifact = normalized.artifact || rawResponse.trim();
    let blackboardDelta: BlackboardDelta = {
        newConstraints: normalized.blackboardDelta.newConstraints || [],
        decisions: normalized.blackboardDelta.decisions || [],
        warnings: normalized.blackboardDelta.warnings || []
    };

    // Backward-compatible protocol parse when envelope extraction did not include delta/trace.
    const traceMatch = rawResponse.match(/###\s*TRACE\s*\n([\s\S]*?)(?=###\s*BLACKBOARD DELTA|###\s*ARTIFACT|$)/i);
    const deltaMatch = rawResponse.match(/###\s*BLACKBOARD DELTA\s*\n([\s\S]*?)(?=###\s*ARTIFACT|$)/i);
    const artifactMatch = rawResponse.match(/###\s*ARTIFACT\s*\n([\s\S]*?)$/i);

    if (!trace && traceMatch) {
        trace = traceMatch[1].trim();
    }

    if ((!artifact || artifact === rawResponse.trim()) && artifactMatch) {
        artifact = artifactMatch[1].trim();
    }

    if (
        blackboardDelta.newConstraints.length === 0 &&
        blackboardDelta.decisions.length === 0 &&
        blackboardDelta.warnings.length === 0 &&
        deltaMatch
    ) {
        let deltaRaw = deltaMatch[1].trim();
        deltaRaw = deltaRaw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();

        const yamlResult = safeYamlParse<{
            newConstraints?: string[];
            decisions?: string[];
            warnings?: string[];
        }>(deltaRaw, null);

        if (yamlResult.success && yamlResult.data) {
            blackboardDelta = {
                newConstraints: yamlResult.data.newConstraints || [],
                decisions: yamlResult.data.decisions || [],
                warnings: yamlResult.data.warnings || []
            };
        } else {
            const jsonResult = safeJsonParse<{
                newConstraints?: string[];
                decisions?: string[];
                warnings?: string[];
            }>(deltaRaw, null);
            if (jsonResult.success && jsonResult.data) {
                blackboardDelta = {
                    newConstraints: jsonResult.data.newConstraints || [],
                    decisions: jsonResult.data.decisions || [],
                    warnings: jsonResult.data.warnings || []
                };
            } else if (deltaRaw.length > 0) {
                const warnings: string[] = [`Delta format issue (could not parse YAML/JSON): ${deltaRaw.substring(0, 100)}...`];
                const lines = deltaRaw.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        const content = trimmed.substring(2).trim();
                        if (content.length > 0) warnings.push(content);
                    }
                }
                blackboardDelta.warnings = warnings;
            }
        }
    }

    const hasUnknown = /\[UNKNOWN:/i.test(artifact) || /\[UNKNOWN:/i.test(rawResponse);
    const hasConflict = /\[CONFLICT:/i.test(artifact) || /\[CONFLICT:/i.test(rawResponse);

    return {
        trace,
        blackboardDelta,
        artifact,
        rawResponse,
        hasUnknown,
        hasConflict,
        modelUsed
    };
}

// ============================================================================
// SPECIALIST CLASS
// ============================================================================

export class Specialist {
    private llmClient: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    };

    constructor(llmClient: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    }) {
        this.llmClient = llmClient;
    }

    /**
     * Execute the specialist on an atomic task
     * 
     * @param input - The specialist input containing task, constitution, and skills
     * @param model - The model to use (routed by Prism complexity score)
     * @param config - Optional configuration for generation
     * @returns The structured specialist output
     */
    async execute(
        input: SpecialistInput,
        model: string,
        config?: SpecialistConfig
    ): Promise<SpecialistOutput> {
        // Build the prompt
        const prompt = buildSpecialistPrompt(input);

        // Call the LLM
        const response = await this.llmClient.generateContent({
            model,
            contents: prompt,
            config: {
                temperature: config?.temperature ?? 0.7,
                maxOutputTokens: config?.maxTokens ?? 4096
            }
        });

        // Parse the response
        const output = parseSpecialistOutput(
            response.text || '',
            response.modelUsed || model
        );

        output.promptUsed = prompt;

        return output;
    }

    /**
     * Validate that the specialist output meets quality requirements
     * (Pre-Surveyor check for obvious issues)
     */
    static validateOutput(output: SpecialistOutput): {
        valid: boolean;
        issues: string[];
    } {
        const issues: string[] = [];

        // Check for missing artifact
        if (!output.artifact || output.artifact.trim().length === 0) {
            issues.push('Missing ARTIFACT section');
        }

        // Check for UNKNOWN/CONFLICT (not necessarily invalid, but flags for review)
        if (output.hasUnknown) {
            issues.push('Output contains [UNKNOWN] marker - requires user intervention');
        }
        if (output.hasConflict) {
            issues.push('Output contains [CONFLICT] marker - requires user intervention');
        }

        // Check for conversational preamble patterns
        const preamblePatterns = [
            /^(Here's|Here is|I've|I have|Based on|Let me|Allow me)/i,
            /^(Certainly|Sure|Of course|Absolutely|Definitely)/i,
            /^(As requested|As you asked|Per your request)/i
        ];

        for (const pattern of preamblePatterns) {
            if (pattern.test(output.artifact)) {
                issues.push('ARTIFACT contains conversational preamble - should be pure deliverable');
                break;
            }
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// ============================================================================
// SKILL INJECTION HELPER
// ============================================================================

/**
 * Format skill injections for the specialist prompt
 * Queries the memory system and formats top related skills
 * 
 * @param skills - Array of skill objects from db.skills
 * @param limit - Maximum number of skills to inject
 */
export function formatSkillInjections(
    skills: Array<{ name: string; description: string; content: string }>,
    limit: number = 3
): string[] {
    return skills.slice(0, limit).map(skill =>
        `**${skill.name}**\n${skill.description}\n\n${skill.content}`
    );
}

// ============================================================================
// LIVING CONSTITUTION BUILDER
// ============================================================================

/**
 * Build the Living Constitution from project state
 * Combines initial constraints with accumulated Blackboard Deltas
 */
export function buildLivingConstitution(
    originalRequirements: string,
    projectContext: {
        domain: string;
        techStack: string[];
        constraints: string[];
    },
    accumulatedDeltas: BlackboardDelta[]
): string {
    // Merge all accumulated constraints
    const allConstraints = [
        ...projectContext.constraints,
        ...accumulatedDeltas.flatMap(d => d.newConstraints)
    ];

    // Merge all accumulated decisions
    const allDecisions = accumulatedDeltas.flatMap(d => d.decisions);

    // Merge all warnings
    const allWarnings = accumulatedDeltas.flatMap(d => d.warnings);

    return `## ORIGINAL REQUIREMENTS
${originalRequirements}

## PROJECT DOMAIN
${projectContext.domain}

## TECH STACK
${projectContext.techStack.map(t => `- ${t}`).join('\n')}

## CONSTRAINTS (BINDING)
${allConstraints.map(c => `- ${c}`).join('\n') || '- None specified'}

## DECISIONS MADE (IMMUTABLE)
${allDecisions.map(d => `- ${d}`).join('\n') || '- None yet'}

## WARNINGS (FROM PREVIOUS AGENTS)
${allWarnings.map(w => `- ⚠️ ${w}`).join('\n') || '- None'}

## SYSTEM CONSTRAINTS
- This is NOT a coding agent - generate Architecture/Strategy/Plans only
- Preserve atomic task structure - one action, one deliverable`;
}

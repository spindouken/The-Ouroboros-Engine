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
import { safeYamlParse, safeJsonParse, extractWithPreference } from '../utils/safe-json';

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
    // LITE MODE: Simplified Code Generation Prompt for Small Models
    // V2.99 SPECIALIST LITE MODE (Performance Optimized for Small Models)
    if (input.isLiteMode) {
        return `YOU ARE A HIGH-PERFORMANCE SYSTEM ARCHITECT (LITE MODE).
Your goal is to generate "Project Soul" (Specs, Contracts, Architecture).

**CRITICAL CONSTRAINT: NO IMPLEMENTATION CODE.**
- DO NOT write function bodies.
- DO NOT write full classes with logic.
- WRITE ONLY: Interfaces, Types, API Schemas, Data Models, Strategy Documents.

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

    return `# SPECIALIST WORKER PROTOCOL (V2.99 Soft-Strict)

## 🔴🔴🔴 CRITICAL CONSTRAINT: NOT A CODING AGENT 🔴🔴🔴

**YOU DO NOT WRITE IMPLEMENTATION CODE. EVER.**

You generate PROJECT SOUL artifacts:
- System architecture specifications
- API contracts (inputs, outputs, error cases, NOT the implementation)
- Data model specifications (entities, relationships, constraints)
- Strategy documents with rationale (WHY something should be done)
- Decision matrices and trade-off analyses
- Technical requirements with justifications

**IF YOU CATCH YOURSELF WRITING ANY OF THESE, STOP IMMEDIATELY:**
- \`import\`, \`from\`, \`require\` statements
- \`function\`, \`const\`, \`let\`, \`var\`, \`def\`, \`class\` as code
- Actual implementation logic with curly braces
- Complete code files

**WHAT TO DO INSTEAD:**

❌ WRONG (Implementation Code):
\`\`\`typescript
const handleLogin = async (email: string, password: string) => {
  const user = await db.users.findByEmail(email);
  if (!user) throw new AuthError('User not found');
  const valid = await bcrypt.compare(password, user.hash);
  return valid ? generateJWT(user) : throw new AuthError('Invalid password');
};
\`\`\`

✅ CORRECT (Architectural Specification):
**Login Handler Specification:**

| Aspect | Specification |
|--------|---------------|
| **Input** | email (string, RFC 5322 format), password (string, 8-128 chars) |
| **Process** | 1. Query user by email, 2. Compare password hash (bcrypt), 3. Generate JWT on success |
| **Output Success** | JWT token (HS256, 1hr expiry) containing userId and role |
| **Output Failure** | 401 with message: "Invalid credentials" (no email/password leak) |
| **Rationale** | Using bcrypt over argon2 due to broader library support in target Node.js ecosystem |
| **Edge Cases** | Rate limit to 5 attempts/minute per IP to prevent brute force |

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
- Architecture, Strategy, Research, Methodology, or Plans ONLY (NOT implementation code)]

---

## CRITICAL DIRECTIVES

1. **REFUSAL DIRECTIVE:** If context is MISSING or AMBIGUOUS, you MUST output:
   - \`[UNKNOWN: <what information is missing>]\` - If you cannot proceed without more info
   - \`[CONFLICT: <describe the contradiction>]\` - If requirements contradict each other
   This triggers a "User Intervention Pause" instead of a hallucinated guess.

2. **NOT A CODING AGENT:** You generate "Project Soul" artifacts:
   - ✅ System Architecture specifications with rationale
   - ✅ API contracts (inputs, outputs, error cases) in TABLE format
   - ✅ Data model specifications (entities, constraints)
   - ✅ Decision matrices with trade-off analysis
   - ✅ Pseudocode for illustration purposes ONLY (not executable)
   - ❌ NEVER: import statements, function definitions, class implementations
   - ❌ NEVER: executable JavaScript, Python, TypeScript, or any code

3. **ATOMIC OUTPUT:** Your response addresses ONE task with ONE clear deliverable.

4. **PURE DELIVERABLE:** The ARTIFACT section contains ONLY the deliverable. No fluff.

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
    // STRATEGY 0: Lite Mode JSON Parsing (Whole Response)
    // ONLY applied when running a node with a small custom model, as requested.
    if (modelUsed === 'local-custom-small') {
        try {
            const liteJson = extractWithPreference<any>(rawResponse, 'json');
            if (liteJson.data && liteJson.data.artifact && liteJson.data.blackboardDelta) {
                console.log('[Specialist:LiteMode] Successfully parsed direct JSON response');

                // FORCE STRING TYPE: Small models sometimes return objects/arrays for "artifact"
                const forceString = (val: any): string => {
                    if (typeof val === 'string') return val;
                    if (val === null || val === undefined) return '';
                    return JSON.stringify(val); // Safety net for object/array hallucinations
                };

                return {
                    trace: forceString(liteJson.data.trace),
                    blackboardDelta: {
                        newConstraints: liteJson.data.blackboardDelta.newConstraints || [],
                        decisions: liteJson.data.blackboardDelta.decisions || [],
                        warnings: liteJson.data.blackboardDelta.warnings || []
                    },
                    artifact: forceString(liteJson.data.artifact),
                    rawResponse: rawResponse,
                    hasUnknown: false,
                    hasConflict: false,
                    modelUsed
                };
            }
        } catch (e) {
            console.warn('[Specialist:LiteMode] Failed to parse JSON response, falling back to regex...', e);
        }
    }
    // Extract sections using regex
    const traceMatch = rawResponse.match(/###\s*TRACE\s*\n([\s\S]*?)(?=###\s*BLACKBOARD DELTA|###\s*ARTIFACT|$)/i);
    const deltaMatch = rawResponse.match(/###\s*BLACKBOARD DELTA\s*\n([\s\S]*?)(?=###\s*ARTIFACT|$)/i);
    const artifactMatch = rawResponse.match(/###\s*ARTIFACT\s*\n([\s\S]*?)$/i);

    const trace = traceMatch ? traceMatch[1].trim() : '';
    let deltaRaw = deltaMatch ? deltaMatch[1].trim() : '';
    // V2.99 Fix: Strip markdown code fences if present
    deltaRaw = deltaRaw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
    const artifact = artifactMatch ? artifactMatch[1].trim() : rawResponse.trim();

    // Parse the blackboard delta - V2.99 Soft-Strict: YAML first, JSON fallback
    let blackboardDelta: BlackboardDelta = {
        newConstraints: [],
        decisions: [],
        warnings: []
    };

    let deltaParseSuccess = false;

    // Strategy 1: Try YAML extraction (V2.99 preferred format)
    const yamlResult = safeYamlParse<{
        newConstraints?: string[];
        decisions?: string[];
        warnings?: string[];
    }>(deltaRaw, null);

    if (yamlResult.success && yamlResult.data) {
        console.log('[Specialist:SoftStrict] Successfully parsed YAML delta');
        blackboardDelta = {
            newConstraints: yamlResult.data.newConstraints || [],
            decisions: yamlResult.data.decisions || [],
            warnings: yamlResult.data.warnings || []
        };
        deltaParseSuccess = true;
    }

    // Strategy 2: JSON fallback (for backward compatibility)
    if (!deltaParseSuccess) {
        try {
            // Extract JSON from the delta section (may be wrapped in markdown code block)
            const jsonMatch = deltaRaw.match(/```json\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : deltaRaw;
            const parsed = JSON.parse(jsonStr);

            console.log('[Specialist:SoftStrict] Successfully parsed JSON delta (fallback)');
            blackboardDelta = {
                newConstraints: parsed.newConstraints || [],
                decisions: parsed.decisions || [],
                warnings: parsed.warnings || []
            };
            deltaParseSuccess = true;
        } catch (e) {
            // JSON parsing also failed
        }
    }

    // Strategy 3: Structured text fallback (last resort)
    if (!deltaParseSuccess && deltaRaw.length > 0) {
        console.warn('[Specialist:SoftStrict] YAML and JSON parsing failed, using structured text fallback');
        blackboardDelta.warnings.push(`Delta format issue (could not parse YAML/JSON): ${deltaRaw.substring(0, 100)}...`);

        // Try to extract any bullet points as constraints/decisions
        const lines = deltaRaw.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const content = trimmed.substring(2).trim();
                if (content.length > 0) {
                    // Heuristic: Add to warnings since we're not sure of the category
                    blackboardDelta.warnings.push(content);
                }
            }
        }
    }

    // Check for UNKNOWN or CONFLICT markers
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

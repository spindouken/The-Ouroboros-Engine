/**
 * The Antagonist Mirror (The Auditor) - Section 4.4
 * 
 * Philosophy: "Trust is a weakness. Prove me wrong." (A 1-on-1 Duel)
 * 
 * This REPLACES the old MultiRoundVoting swarm consensus system.
 * Instead of voting with multiple agents, we use a single hostile reviewer
 * in a 1-on-1 duel against the Specialist's output.
 * 
 * Key Principles:
 * 1. **Habeas Corpus Rule:** Cannot reject without citing EVIDENCE
 *    - Must provide a Direct Quote from Constitution or Artifact
 *    - Must demonstrate the specific contradiction
 * 
 * 2. **One Repair Attempt Limit:**
 *    - On Fail: Return "Evidence of Failure" to Specialist for ONE focused repair
 *    - If second rejection occurs: Mark as FINAL FAILURE
 *    - On Pass: Mark Brick as `verified`
 * 
 * 3. **Hostile Reviewer, Not Collaborative:**
 *    - Antagonist actively tries to find flaws
 *    - No consensus-seeking behavior
 *    - Evidence-based rejection only
 * 
 * █ ANCHOR 5b: ANTAGONIST MIRROR (The Auditor)
 * 1. Evidence Structure
 * 2. The Duel Protocol
 * 3. The Habeas Corpus Rule
 */

import { LLMResponse } from './UnifiedLLMClient';
import { extractWithPreference } from '../utils/safe-json';
import { type ProjectMode } from './genesis-protocol';
import { isValidMode } from './utils/mode-helpers';
import type { TribunalStrictnessProfile } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type AntagonistVerdict = 'pass' | 'fail';

export interface EvidenceItem {
    // █ ANCHOR 5.5: Evidence Structure
    /** Type of evidence: quote from constitution or quote from artifact */
    type: 'constitution_quote' | 'artifact_quote' | 'logical_contradiction';

    /** The exact quote or description */
    content: string;

    /** Why this is a problem */
    explanation: string;
}

export interface AntagonistResult {
    /** The final verdict */
    verdict: AntagonistVerdict;

    /** Confidence in the verdict (0-100) */
    confidence: number;

    /** Evidence supporting the verdict (required for rejection) */
    evidence: EvidenceItem[];

    /** Overall reasoning for the decision */
    reasoning: string;

    /** Specific issues found (if any) */
    issues: string[];

    /** Suggestions for repair (if verdict is fail) */
    repairSuggestions: string[];

    /** Raw response from the LLM */
    rawResponse: string;

    /** Model used for the audit */
    modelUsed: string;
}

export interface RepairAttempt {
    /** Attempt number (1 = first attempt, 2 = second/final attempt) */
    attemptNumber: number;

    /** The evidence that caused the failure */
    failureEvidence: EvidenceItem[];

    /** The repair suggestions provided */
    repairSuggestions: string[];

    /** The original artifact that failed */
    originalArtifact: string;

    /** The repaired artifact (after repair attempt) */
    repairedArtifact?: string;

    /** Result of re-audit after repair */
    reauditResult?: AntagonistResult;
}

export interface DuelResult {
    /** Final outcome of the duel */
    outcome: 'verified' | 'repaired_and_verified' | 'final_failure';

    /** The final artifact (original or repaired) */
    finalArtifact: string;

    /** Initial audit result */
    initialAudit: AntagonistResult;

    /** Repair attempt (if any) */
    repairAttempt?: RepairAttempt;

    /** Total number of audit rounds (1 or 2) */
    totalRounds: number;

    /** Whether the brick should be marked as verified */
    isVerified: boolean;
}

export interface AntagonistConfig {
    /** Model to use for antagonist (should be high-reasoning, e.g., Claude 3.5 Sonnet) */
    model: string;

    /** Temperature for audit (lower = more deterministic/critical) */
    temperature?: number;

    /** Maximum tokens for response */
    maxTokens?: number;

    /** Lite Mode: Use simplified checklist prompt for small models (4B/8B) */
    isLiteMode?: boolean;

    /** Strictness profile for hard/soft fail calibration */
    strictnessProfile?: TribunalStrictnessProfile;
}

/**
 * Get mode-specific audit criteria for Antagonist prompt construction
 *
 * Defines automatic failure conditions for each supported project mode.
 *
 * @param mode - The current project mode
 * @returns Mode-specific audit criteria text
 */
export function getAuditCriteriaForMode(mode: ProjectMode): string {
    const criteria: Record<ProjectMode, string> = {
        software: `
AUTOMATIC FAILURES:
- Implementation code (import, function, class definitions)
- Technologies NOT in Constitution
`,
        scientific_research: `
AUTOMATIC FAILURES:
- Claims without citations
- Personal opinions without evidence
`,
        legal_research: `
AUTOMATIC FAILURES:
- Legal advice language ("you should", "I recommend")
- Missing case/statute citations
`,
        creative_writing: `
AUTOMATIC FAILURES:
- Full prose passages (should be structural only)
- Missing beat structure
`,
        general: `
AUTOMATIC FAILURES:
- Contradictions with Constitution
`
    };

    return criteria[mode] || criteria.general;
}

/**
 * Extract project mode from Constitution string.
 * Supports JSON and plain-text/markdown formats.
 */
export function extractModeFromConstitutionText(constitution: string): ProjectMode {
    // Strategy 1: JSON constitution (if serialized as JSON)
    try {
        const parsed = JSON.parse(constitution);
        if (isValidMode(parsed?.mode)) {
            return parsed.mode;
        }
    } catch {
        // Continue to regex-based extraction.
    }

    // Strategy 2: Inline "mode: value" (JSON-like or YAML-like)
    const inlineModePattern = /["']?mode["']?\s*:\s*["']?(software|scientific_research|legal_research|creative_writing|general)["']?/i;
    const inlineMatch = constitution.match(inlineModePattern);
    if (inlineMatch) {
        const inlineCandidate = inlineMatch[1].trim().toLowerCase();
        if (isValidMode(inlineCandidate)) {
            return inlineCandidate;
        }
    }

    // Strategy 3: Markdown section:
    // ## PROJECT MODE
    // scientific_research
    const headingModePattern = /##\s*PROJECT MODE[\s\r\n]+([a-z_]+)/i;
    const headingMatch = constitution.match(headingModePattern);
    if (headingMatch) {
        const candidate = headingMatch[1].trim().toLowerCase();
        if (isValidMode(candidate)) {
            return candidate;
        }
    }

    return 'software';
}

// ============================================================================
// ANTAGONIST MIRROR CLASS
// ============================================================================

export class AntagonistMirror {
    private llmClient: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    };

    private config: AntagonistConfig;

    constructor(
        llmClient: {
            generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
        },
        config: AntagonistConfig
    ) {
        this.llmClient = llmClient;
        this.config = {
            model: config.model,
            temperature: config.temperature ?? 0.3, // Low temp for critical analysis
            maxTokens: config.maxTokens ?? 2048,
            isLiteMode: config.isLiteMode,
            strictnessProfile: config.strictnessProfile ?? 'balanced'
        };
    }

    /**
     * Conduct a 1-on-1 Duel between the Antagonist and an Artifact
     * 
     * @param artifact - The artifact to audit
     * @param constitution - The Living Constitution (project constraints)
     * @param atomicInstruction - The original task instruction
     * @param onRepair - Callback function to repair the artifact if needed
     * @returns DuelResult with final outcome
     */
    async conductDuel(
        artifact: string,
        constitution: string,
        atomicInstruction: string,
        onRepair?: (evidence: EvidenceItem[], suggestions: string[]) => Promise<string>
    ): Promise<DuelResult> {
        // Round 1: Initial Audit
        const initialAudit = await this.audit(artifact, constitution, atomicInstruction);

        // If passed on first try, mark as verified
        if (initialAudit.verdict === 'pass') {
            return {
                outcome: 'verified',
                finalArtifact: artifact,
                initialAudit,
                totalRounds: 1,
                isVerified: true
            };
        }

        // If failed but no repair callback provided, mark as final failure
        if (!onRepair) {
            return {
                outcome: 'final_failure',
                finalArtifact: artifact,
                initialAudit,
                totalRounds: 1,
                isVerified: false
            };
        }

        // Round 2: Repair Attempt (ONE chance only)
        const repairAttempt: RepairAttempt = {
            attemptNumber: 1,
            failureEvidence: initialAudit.evidence,
            repairSuggestions: initialAudit.repairSuggestions,
            originalArtifact: artifact
        };

        // Call the repair callback with evidence
        const repairedArtifact = await onRepair(
            initialAudit.evidence,
            initialAudit.repairSuggestions
        );
        repairAttempt.repairedArtifact = repairedArtifact;

        // Re-audit the repaired artifact
        const reauditResult = await this.audit(repairedArtifact, constitution, atomicInstruction);
        repairAttempt.reauditResult = reauditResult;

        // Determine final outcome
        if (reauditResult.verdict === 'pass') {
            return {
                outcome: 'repaired_and_verified',
                finalArtifact: repairedArtifact,
                initialAudit,
                repairAttempt,
                totalRounds: 2,
                isVerified: true
            };
        }

        // Second rejection = FINAL FAILURE (no more chances)
        return {
            outcome: 'final_failure',
            finalArtifact: repairedArtifact,
            initialAudit,
            repairAttempt,
            totalRounds: 2,
            isVerified: false
        };
    }

    /**
     * Audit an artifact against the constitution
     * Implements the Habeas Corpus Rule - must cite evidence for rejection
     */
    async audit(
        artifact: string,
        constitution: string,
        atomicInstruction: string
    ): Promise<AntagonistResult> {
        const prompt = this.buildAuditPrompt(artifact, constitution, atomicInstruction);

        const response = await this.llmClient.generateContent({
            model: this.config.model,
            contents: prompt,
            config: {
                // Removed JSON enforcement to allow thinking
                temperature: this.config.temperature,
                maxOutputTokens: this.config.maxTokens
            }
        });

        return this.parseAuditResponse(response.text || '', response.modelUsed || this.config.model);
    }

    /**
     * Build the audit prompt following the Habeas Corpus Rule
     */
    /**
     * Build the audit prompt following the Habeas Corpus Rule
     */
    private buildAuditPrompt(
        artifact: string,
        constitution: string,
        atomicInstruction: string
    ): string {
        const mode = extractModeFromConstitutionText(constitution);
        const modeSpecificAuditCriteria = getAuditCriteriaForMode(mode);
        const strictnessProfile = this.config.strictnessProfile || 'balanced';
        const strictnessGuide = strictnessProfile === 'strict'
            ? `STRICT PROFILE:
- Treat significant incompleteness as fail when it blocks downstream tasks.
- Prefer fail over pass when constraints are ambiguous but potentially violated.`
            : strictnessProfile === 'local_small'
                ? `LOCAL-SMALL PROFILE:
- HARD FAIL only for explicit rule breaks with direct evidence.
- Use REPAIR SUGGESTIONS for quality gaps instead of rejection whenever possible.`
                : `BALANCED PROFILE:
- HARD FAIL on explicit rule breaks or contradictions.
- Use repair suggestions for non-blocking quality issues.`;

        // ANCHOR 5.4: The Habeas Corpus Rule
        // LITE MODE: Simplified Specification Auditor
        if (this.config.isLiteMode) {
            return `YOU ARE THE ANTAGONIST AUDITOR (LITE MODE).
Your goal: Verify compliance with the Input Constitution.

PROJECT MODE: ${mode}

**CRITICAL AUDIT CRITERIA:**
1. **CHECK CONSISTENCY:** Does the Artifact match the Constitution?
2. **CHECK INSTRUCTION:** Does it fulfill the specific task?
3. **CHECK FORMAT:** Is it a Specification (good) or Implementation Code (bad)?
4. **MODE-SPECIFIC FAILURES:**
${modeSpecificAuditCriteria}
5. **STRICTNESS PROFILE:** ${strictnessProfile}
${strictnessGuide}

**FAIL TAXONOMY:**
- HARD FAIL: constitution contradiction, explicit forbidden output, or direct instruction failure.
- SOFT FAIL: quality/completeness issues that should return repair suggestions.

**INPUTS:**
CONSTITUTION: ${constitution}
INSTRUCTION: ${atomicInstruction}
ARTIFACT: ${artifact}

**OUTPUT FORMAT (JSON ONLY - No Markdown):**
{
  "verified": boolean,
  "score": number (0-100),
  "reasoning": "Brief explanation of pass/fail",
  "evidence": [{"type":"violation", "content":"Quote...", "explanation":"Why it fails"}],
  "issues": ["Issue 1"],
  "repairSuggestions": ["Fix 1"]
}`;
        }

        return `# ANTAGONIST MIRROR PROTOCOL

                ** Your Role:** The Hostile Auditor
                    ** Philosophy:** "Trust is a weakness. Prove me wrong."
                        ** Context:** Standard Mode

You are conducting a 1 - on - 1 DUEL.Your job is to find FLAWS in the artifact.
You are NOT a collaborative reviewer.You are a hostile critic.

---

## THE LIVING CONSTITUTION(Binding Rules)
            """
${constitution}
            """

## THE ORIGINAL INSTRUCTION
            """
${atomicInstruction}
            """

## THE ARTIFACT TO AUDIT
            """
${artifact}
            """

            ---
## ARCHITECTURAL CONSISTENCY CHECK(CRITICAL)

You must verify that the Artifact does NOT contradict established Decisions or Constraints.
- Does it introduce a new technology when a different one was chosen ?
                - Does it violate a constraint ?

** Rules :**
                    1. New technologies(Languages, Frameworks, Databases) NOT in the Constitution are AUTOMATIC FAILURES unless explicitly requested by the Instruction.
2. ** EXCEPTION:** Standard Design Patterns(e.g., Singleton, LOD, Caching strategies) are ALLOWED and are NOT considered "New Technologies".
3. ** EXCEPTION:** Features explicitly requested by the User(e.g., "Gamification") MUST be allowed, even if you personally dislike them.

---

## MODE-SPECIFIC AUDIT CRITERIA (CRITICAL)

PROJECT MODE: ${mode}
${modeSpecificAuditCriteria}

## STRICTNESS PROFILE
${strictnessGuide}

## FAIL TAXONOMY (CRITICAL)
- HARD FAIL: constitution contradiction, explicit forbidden output, direct instruction failure.
- SOFT FAIL: quality or style gaps; provide repair suggestions first.
- In LOCAL-SMALL profile, avoid HARD FAIL unless evidence is explicit and direct.

---

## THE HABEAS CORPUS RULE

                ** CRITICAL:** You CANNOT reject without citing EVIDENCE.

If you find a flaw, you MUST provide:
            1. A ** Direct Quote ** from the Constitution OR the Artifact
            2. An ** Explanation ** of why this is a contradiction or violation
            3. ** Specific repair suggestions **

                If you cannot cite specific evidence, you MUST pass the artifact.

---

## YOUR TASK

Analyze the artifact.Determine if it:
                1. Fulfills the atomic instruction
            2. Adheres to ALL constitution constraints
            3. Is internally consistent(no contradictions)
            4. Is complete(no missing critical elements)
            5. Is NOT implementation code(this is NOT a coding agent)

            ---

## YOUR TASK

            1. ** THINK(Markdown):**
                - Conduct a hostile review.
   - Look for specific violations of the Constitution.
   - Look for logic errors in the Artifact.
   - Cite your evidence.

2. ** VERDICT(YAML):**
                - Output your final decision in YAML format.

## OUTPUT FORMAT

            \`\`\`yaml
verdict: pass # or fail
confidence: 0-100
reasoning: "Overall explanation of your decision"
evidence:
  - type: constitution_quote # or artifact_quote, logical_contradiction
    content: "The exact quote or description"
    explanation: "Why this is a problem"
issues:
  - "Specific issue 1"
  - "Specific issue 2"
repairSuggestions:
  - "How to fix issue 1"
  - "How to fix issue 2"
\`\`\`

**REMEMBER:**
- Empty "evidence" array is REQUIRED for a "pass" verdict
- Non-empty "evidence" array is REQUIRED for a "fail" verdict (Habeas Corpus)
- You are HOSTILE - look for flaws actively
- But you are FAIR - you need real evidence to reject

Begin your audit:`;
    }
    /**
     * Parse the audit response into structured format
     */
    private parseAuditResponse(response: string, modelUsed: string): AntagonistResult {
        const defaultResult: AntagonistResult = {
            verdict: 'pass', // Default to pass if parsing fails
            confidence: 50,
            evidence: [],
            reasoning: 'Failed to parse audit response',
            issues: [],
            repairSuggestions: [],
            rawResponse: response,
            modelUsed
        };

        try {
            // Use Soft-Strict extraction (YAML preferred)
            const extracted = extractWithPreference<any>(response, 'yaml');
            const parsed = extracted.data || {};

            if (!extracted.data) {
                // If extraction failed completely
                return {
                    ...defaultResult,
                    reasoning: 'Failed to extract structured data (YAML/JSON) from audit response',
                    rawResponse: response
                };
            }

            const evidence: EvidenceItem[] = (parsed.evidence || []).map((e: any) => ({
                type: e.type || 'logical_contradiction',
                content: e.content || 'Unspecified',
                explanation: e.explanation || 'No explanation provided'
            }));

            const parsedVerdict = typeof parsed.verdict === 'string'
                ? parsed.verdict
                : (typeof parsed.verified === 'boolean' ? (parsed.verified ? 'pass' : 'fail') : 'pass');

            // Enforce Habeas Corpus: If verdict is 'fail', evidence is required
            const verdict = parsedVerdict === 'fail' && evidence.length > 0 ? 'fail' :
                parsedVerdict === 'fail' && evidence.length === 0 ? 'pass' : // Override: no evidence = pass
                    parsedVerdict || 'pass';

            return {
                verdict: verdict as AntagonistVerdict,
                confidence: parsed.confidence ?? parsed.score ?? 50,
                evidence,
                reasoning: parsed.reasoning || 'No reasoning provided',
                issues: parsed.issues || [],
                repairSuggestions: parsed.repairSuggestions || [],
                rawResponse: response,
                modelUsed
            };
        } catch (e) {
            return defaultResult;
        }
    }

    /**
     * Update the antagonist configuration
     */
    updateConfig(config: Partial<AntagonistConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get the current model being used
     */
    getModel(): string {
        return this.config.model;
    }
}

// ============================================================================
// DUEL SUMMARY FORMATTER
// ============================================================================

/**
 * Format a duel result for logging/display
 */
export function formatDuelResult(result: DuelResult): string {
    const statusEmoji = {
        verified: '✅',
        repaired_and_verified: '🔧✅',
        final_failure: '❌'
    };

    let output = `## Antagonist Duel Result: ${statusEmoji[result.outcome]} ${result.outcome.toUpperCase()}\n\n`;

    output += `**Rounds:** ${result.totalRounds}\n`;
    output += `**Verified:** ${result.isVerified}\n\n`;

    output += `### Initial Audit\n`;
    output += `- Verdict: ${result.initialAudit.verdict}\n`;
    output += `- Confidence: ${result.initialAudit.confidence}%\n`;
    output += `- Reasoning: ${result.initialAudit.reasoning}\n`;

    if (result.initialAudit.evidence.length > 0) {
        output += `\n**Evidence:**\n`;
        result.initialAudit.evidence.forEach((e, i) => {
            output += `${i + 1}. [${e.type}] "${e.content}"\n   → ${e.explanation}\n`;
        });
    }

    if (result.repairAttempt) {
        output += `\n### Repair Attempt\n`;
        const reaudit = result.repairAttempt.reauditResult;
        if (reaudit) {
            output += `- Re-audit Verdict: ${reaudit.verdict}\n`;
            output += `- Re-audit Confidence: ${reaudit.confidence}%\n`;
        }
    }

    return output;
}

// ============================================================================
// EVIDENCE FORMATTER FOR SPECIALIST REPAIR
// ============================================================================

/**
 * Format evidence for return to Specialist for focused repair
 */
export function formatEvidenceForRepair(
    evidence: EvidenceItem[],
    suggestions: string[]
): string {
    if (evidence.length === 0) {
        return 'No specific evidence provided.';
    }

    let output = `## ANTAGONIST REJECTION - EVIDENCE OF FAILURE\n\n`;
    output += `The following issues were identified. You have ONE attempt to fix them.\n\n`;

    output += `### Evidence\n`;
    evidence.forEach((e, i) => {
        output += `\n**Issue ${i + 1}:** [${e.type}]\n`;
        output += `> "${e.content}"\n`;
        output += `**Problem:** ${e.explanation}\n`;
    });

    if (suggestions.length > 0) {
        output += `\n### Repair Suggestions\n`;
        suggestions.forEach((s, i) => {
            output += `${i + 1}. ${s}\n`;
        });
    }

    output += `\n---\n`;
    output += `**IMPORTANT:** This is your ONLY repair attempt. Address ALL issues above.\n`;

    return output;
}

// ============================================================================
// QUICK AUDIT (Lightweight version for pre-checks)
// ============================================================================

/**
 * Quick audit without the full duel process
 * Useful for preliminary checks before full audit
 */
export async function quickAudit(
    artifact: string,
    constitution: string,
    llmClient: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    },
    model: string
): Promise<AntagonistResult> {
    const antagonist = new AntagonistMirror(llmClient, { model });
    return antagonist.audit(artifact, constitution, 'Quick audit - verify general compliance');
}

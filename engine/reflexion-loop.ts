/**
 * The Reflexion Loop (Worker Self-Correction) - Section 4.2
 * 
 * Role: The Cheap Mirror
 * 
 * Concept: Don't send garbage to the expensive Audit (Antagonist).
 * This is a "Cheap Sanity Check" that runs immediately after the Specialist
 * generates output, but BEFORE the expensive Surveyor/Antagonist chain.
 * 
 * Mechanism:
 * 1. Immediately after generation, run a fast critique call (Gemini Flash)
 * 2. The critique asks: "List 3 potential flaws in your work"
 * 3. If flaws are found, perform a Fast Repair
 * 4. Submit the repaired output to the Surveyor
 * 
 * Cost: Negligible (uses cheapest/fastest model)
 * Benefit: Drastically reduces Antagonist rejection rate
 */

import { LLMResponse } from './UnifiedLLMClient';
import { extractWithPreference } from '../utils/safe-json';
import { SpecialistOutput } from './specialist';

// ============================================================================
// TYPES
// ============================================================================

export interface CritiqueResult {
    /** The 3 flaws identified */
    flaws: CritiqueFlaw[];

    /** Whether the output needs repair */
    needsRepair: boolean;

    /** Overall quality assessment (1-10) */
    qualityScore: number;

    /** Raw critique response */
    rawCritique: string;
}

export interface CritiqueFlaw {
    /** Description of the flaw */
    description: string;

    /** Severity: 'critical' | 'major' | 'minor' */
    severity: 'critical' | 'major' | 'minor';

    /** Suggested fix */
    suggestedFix: string;
}

export interface RepairResult {
    /** The repaired artifact */
    repairedArtifact: string;

    /** Changes made during repair */
    changesMade: string[];

    /** Whether the repair was successful */
    success: boolean;

    /** Raw repair response */
    rawResponse: string;
}

export interface ReflexionResult {
    /** The original output from Specialist */
    originalOutput: SpecialistOutput;

    /** The critique result */
    critique: CritiqueResult;

    /** The repair result (if repair was needed) */
    repair: RepairResult | null;

    /** The final output to send to Surveyor */
    finalOutput: SpecialistOutput;

    /** Whether any changes were made */
    wasRepaired: boolean;

    /** Model used for critique */
    critiqueModel: string;
}

// ============================================================================
// REFLEXION LOOP CLASS
// ============================================================================

export class ReflexionLoop {
    private llmClient: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    };

    /** The fast/cheap model to use for critique (e.g., Gemini Flash) */
    private critiqueModel: string;

    /** Threshold for triggering repair (flaws with severity >= this trigger repair) */
    private repairThreshold: 'minor' | 'major' | 'critical' = 'major';

    constructor(
        llmClient: {
            generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
        },
        critiqueModel: string = 'gemini-1.5-flash'
    ) {
        this.llmClient = llmClient;
        this.critiqueModel = critiqueModel;
    }

    /**
     * Run the Reflexion Loop on a Specialist output
     * 
     * @param output - The Specialist's output to critique and potentially repair
     * @param atomicInstruction - The original task (for context in critique)
     * @returns The ReflexionResult with possibly repaired output
     */
    async reflect(
        output: SpecialistOutput,
        atomicInstruction: string,
        livingConstitution: string,
        priorTribunalFeedback?: string
    ): Promise<ReflexionResult> {
        // Step 1: Run the critique
        const critique = await this.runCritique(output, atomicInstruction, livingConstitution, priorTribunalFeedback);

        // Step 2: Determine if repair is needed
        const needsRepair = this.shouldRepair(critique);

        let repair: RepairResult | null = null;
        let finalOutput = output;

        // Step 3: If repair needed, perform Fast Repair
        if (needsRepair) {
            repair = await this.runRepair(output, critique, atomicInstruction, livingConstitution, priorTribunalFeedback);

            if (repair.success) {
                // Update the output with repaired artifact
                finalOutput = {
                    ...output,
                    artifact: repair.repairedArtifact,
                    // Keep original trace and delta, add repair note to trace
                    trace: output.trace + `\n\n[REFLEXION REPAIR APPLIED]\nChanges: ${repair.changesMade.join(', ')}`
                };
            }
        }

        return {
            originalOutput: output,
            critique,
            repair,
            finalOutput,
            wasRepaired: repair?.success ?? false,
            critiqueModel: this.critiqueModel
        };
    }

    /**
     * Run the self-critique step
     */
    private async runCritique(
        output: SpecialistOutput,
        atomicInstruction: string,
        livingConstitution: string,
        priorTribunalFeedback?: string
    ): Promise<CritiqueResult> {
        const prompt = this.buildCritiquePrompt(output, atomicInstruction, livingConstitution, priorTribunalFeedback);

        const response = await this.llmClient.generateContent({
            model: this.critiqueModel,
            contents: prompt,
            config: {
                temperature: 0.3, // Lower temp for more consistent critique
                maxOutputTokens: 1024
            }
        });

        return this.parseCritiqueResponse(response.text || '');
    }

    /**
     * Run the fast repair step
     */
    private async runRepair(
        output: SpecialistOutput,
        critique: CritiqueResult,
        atomicInstruction: string,
        livingConstitution: string,
        priorTribunalFeedback?: string
    ): Promise<RepairResult> {
        const prompt = this.buildRepairPrompt(output, critique, atomicInstruction, livingConstitution, priorTribunalFeedback);

        const response = await this.llmClient.generateContent({
            model: this.critiqueModel, // Use same fast model for repair
            contents: prompt,
            config: {
                temperature: 0.5,
                maxOutputTokens: 4096
            }
        });

        return this.parseRepairResponse(response.text || '', output.artifact);
    }

    /**
     * Build the critique prompt
     */
    private buildCritiquePrompt(
        output: SpecialistOutput,
        atomicInstruction: string,
        livingConstitution: string,
        priorTribunalFeedback?: string
    ): string {
        const tribunalSection = priorTribunalFeedback
            ? `
## PRIOR TRIBUNAL FEEDBACK (FROM LAST FAILED ATTEMPT)
"""
${priorTribunalFeedback}
"""
`
            : '';

        return `# REFLEXION SELF-CRITIQUE PROTOCOL

You are reviewing your own work. Be BRUTALLY HONEST about flaws.

## THE LIVING CONSTITUTION (CONTEXT & RULES)
"""
${livingConstitution}
"""

## THE ORIGINAL TASK
"""
${atomicInstruction}
"""
${tribunalSection}

## YOUR OUTPUT TO CRITIQUE
"""
${output.artifact}
"""

## YOUR TASK

Critique your own work. List EXACTLY 3 potential flaws.

For each flaw, assess:
1. **Description**: What is wrong?
2. **Severity**: "critical" (breaks requirements), "major" (significant issue), or "minor" (improvement opportunity)
3. **Suggested Fix**: How to fix it?

Also provide an overall quality score from 1-10.

## OUTPUT FORMAT

## OUTPUT FORMAT

Respond with ONLY this YAML:

\`\`\`yaml
flaws:
  - description: "Flaw 1 description"
    severity: critical # or major, minor
    suggestedFix: "How to fix"
  - description: "Flaw 2 description"
    severity: major
    suggestedFix: "Fix"
qualityScore: 7
\`\`\`

Be critical but fair. If the output is genuinely good, flaws can be "minor" level.`;
    }

    /**
     * Build the repair prompt
     */
    private buildRepairPrompt(
        output: SpecialistOutput,
        critique: CritiqueResult,
        atomicInstruction: string,
        livingConstitution: string,
        priorTribunalFeedback?: string
    ): string {
        const flawsStr = critique.flaws
            .filter(f => f.severity === 'critical' || f.severity === 'major')
            .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.description}\n   Fix: ${f.suggestedFix}`)
            .join('\n');

        const tribunalSection = priorTribunalFeedback
            ? `
## PRIOR TRIBUNAL FEEDBACK (MUST BE RESOLVED)
"""
${priorTribunalFeedback}
"""
`
            : '';

        return `# REFLEXION FAST REPAIR PROTOCOL

You must fix the identified flaws in this output.

## THE LIVING CONSTITUTION (CONTEXT & RULES)
"""
${livingConstitution}
"""

## THE ORIGINAL TASK
"""
${atomicInstruction}
"""
${tribunalSection}

## THE FLAWED OUTPUT
"""
${output.artifact}
"""

## FLAWS TO FIX
${flawsStr}

## YOUR TASK

Fix the flaws listed above. Output the REPAIRED version.

## CRITICAL RULES

1. Focus ONLY on fixing the identified flaws
2. Do NOT add new content unless required for the fix
3. Do NOT change parts that are working correctly
4. Maintain the same structure and format
5. Output ONLY the repaired artifact - no explanations

## OUTPUT FORMAT

### CHANGES_MADE
[List each change you made, one per line]

### REPAIRED_ARTIFACT
[The fixed output - pure deliverable only]`;
    }

    /**
     * Parse the critique response into structured format
     */
    private parseCritiqueResponse(response: string): CritiqueResult {
        const defaultResult: CritiqueResult = {
            flaws: [],
            needsRepair: false,
            qualityScore: 5,
            rawCritique: response
        };

        try {
            // Use Soft-Strict extraction (YAML preferred)
            const extracted = extractWithPreference<any>(response, 'yaml');
            const parsed = extracted.data || {};

            if (!extracted.data) {
                return defaultResult;
            }

            const flaws: CritiqueFlaw[] = (parsed.flaws || []).map((f: any) => ({
                description: f.description || 'Unknown flaw',
                severity: this.normalizeSeverity(f.severity),
                suggestedFix: f.suggestedFix || 'No fix suggested'
            }));

            const hasCriticalOrMajor = flaws.some(
                f => f.severity === 'critical' || f.severity === 'major'
            );

            return {
                flaws,
                needsRepair: hasCriticalOrMajor,
                qualityScore: parsed.qualityScore || 5, // Handle 0? No, 0 is faulty usually. 
                rawCritique: response
            };
        } catch (e) {
            return defaultResult;
        }
    }

    /**
     * Parse the repair response
     */
    private parseRepairResponse(response: string, originalArtifact: string): RepairResult {
        // Extract changes made
        const changesMatch = response.match(/###\s*CHANGES_MADE\s*\n([\s\S]*?)(?=###\s*REPAIRED_ARTIFACT|$)/i);
        const changesMade = changesMatch
            ? changesMatch[1].trim().split('\n').filter(l => l.trim())
            : [];

        // Extract repaired artifact
        const artifactMatch = response.match(/###\s*REPAIRED_ARTIFACT\s*\n([\s\S]*?)$/i);
        const repairedArtifact = artifactMatch
            ? artifactMatch[1].trim()
            : response.trim();

        // Determine success - did we actually get a repaired artifact?
        const success = repairedArtifact.length > 0 && repairedArtifact !== originalArtifact;

        return {
            repairedArtifact: success ? repairedArtifact : originalArtifact,
            changesMade,
            success,
            rawResponse: response
        };
    }

    /**
     * Normalize severity string to valid type
     */
    private normalizeSeverity(severity: string): 'critical' | 'major' | 'minor' {
        const normalized = (severity || '').toLowerCase();
        if (normalized === 'critical') return 'critical';
        if (normalized === 'major') return 'major';
        return 'minor';
    }

    /**
     * Determine if the output needs repair based on critique
     */
    private shouldRepair(critique: CritiqueResult): boolean {
        // Repair if there are critical or major flaws
        const hasSevereFlaws = critique.flaws.some(
            f => f.severity === 'critical' || f.severity === 'major'
        );

        // Or if quality score is very low
        const lowQuality = critique.qualityScore < 5;

        return hasSevereFlaws || lowQuality;
    }

    /**
     * Set the repair threshold
     */
    setRepairThreshold(threshold: 'minor' | 'major' | 'critical'): void {
        this.repairThreshold = threshold;
    }

    /**
     * Update the critique model
     */
    setCritiqueModel(model: string): void {
        this.critiqueModel = model;
    }
}

// ============================================================================
// QUICK REFLEXION (Simplified Version)
// ============================================================================

/**
 * A simplified reflexion that just checks for obvious issues
 * without making an LLM call - useful as a pre-filter
 */
export function quickReflexion(artifact: string): {
    issues: string[];
    shouldProceed: boolean;
} {
    const issues: string[] = [];

    // Check for common issues that indicate low quality

    // 1. Too short (probably incomplete)
    if (artifact.length < 50) {
        issues.push('Output is suspiciously short (< 50 chars)');
    }

    // 2. Contains "TODO" or placeholder patterns
    if (/\b(TODO|FIXME|XXX|PLACEHOLDER)\b/i.test(artifact)) {
        issues.push('Output contains TODO/placeholder markers');
    }

    // 3. Contains obvious error patterns
    if (/\b(error|exception|failed|undefined|null)\b/i.test(artifact.substring(0, 200))) {
        issues.push('Output may contain error indicators');
    }

    // 4. Starts with apology or uncertainty
    if (/^(I'm sorry|I apologize|Unfortunately|I cannot)/i.test(artifact)) {
        issues.push('Output starts with apology/refusal pattern');
    }

    return {
        issues,
        shouldProceed: issues.length === 0
    };
}

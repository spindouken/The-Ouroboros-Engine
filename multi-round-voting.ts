// ============================================================================
// MULTI-ROUND VOTING SYSTEM (Tiered & Conflict Resolution)
// ============================================================================
// Implements iterative voting with "First-to-ahead-by-k" logic, Veto power,
// Tiered Voting (cheaper models first), and Conflict Resolution.
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3
// ============================================================================

import type { VotingResult, JudgeOutput } from './types';

/**
 * Multi-Round Voting System
 * 
 * Conducts iterative voting using "First-to-ahead-by-k" protocol.
 * - Streaming votes from distinct verifier roles.
 * - Terminates early if one side (Pass/Fail) leads by K votes.
 * - Immediate Veto if a critical flaw is found.
 * - Tiered Voting: Use cheaper models for initial checks.
 * - Conflict Resolution: Security > Efficiency.
 */
export interface MultiRoundVotingSystem {
  conductVoting(
    spec: string,
    round: number,
    ai: any,
    models: { default: string; cheap: string; advanced: string },
    context?: string,
    originalRequirements?: string
  ): Promise<VotingResult>;
  calculateVariance(scores: number[]): number;
}



const K_THRESHOLD = 2; // "First to ahead by 2"

export function createMultiRoundVotingSystem(): MultiRoundVotingSystem {

  const calculateVariance = (scores: number[]): number => {
    if (scores.length === 0) return 0;
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
  };

  const getVerifierRole = (index: number) => {
    const roles = [
      { id: 'logic_verifier', label: 'Logic Verifier', persona: 'You are a Logic Verifier. Check for logical fallacies, circular reasoning, and race conditions.', focus: 'Logic & Consistency', priority: 'high' },
      { id: 'req_verifier', label: 'Requirements Verifier', persona: 'You are a Requirements Verifier. Check if the spec meets the original goal and constraints.', focus: 'Requirements Alignment', priority: 'medium' },
      { id: 'proof_verifier', label: 'Proof Verifier', persona: 'You are a Proof Verifier. Check the formal proof for validity and soundness.', focus: 'Proof Validity', priority: 'high' },
      { id: 'security_verifier', label: 'Security Auditor', persona: 'You are a Security Auditor. Check for vulnerabilities and safety risks.', focus: 'Security', priority: 'critical' },
      { id: 'perf_verifier', label: 'Performance Engineer', persona: 'You are a Performance Engineer. Check for efficiency and scalability issues.', focus: 'Performance', priority: 'low' }
    ];
    return roles[index % roles.length];
  };

  const CONSTITUTION = `
  **THE CONSTITUTION (CORE AXIOMS):**
  1. **The Axiom of Improvement:** New code must be objectively better than the code it replaces.
  2. **The Axiom of Safety:** No change shall compromise the security or integrity of the system.
  3. **The Axiom of Truth:** The system shall not hallucinate or fabricate data.
  4. **The Axiom of Fidelity:** The implementation must strictly adhere to the approved Specification.
  `;

  const conductVoting = async (
    spec: string,
    round: number,
    ai: any,
    models: { default: string; cheap: string; advanced: string },
    context: string = "Evaluate this specification.",
    originalRequirements: string = ""
  ): Promise<VotingResult> => {

    const judgeOutputs: JudgeOutput[] = [];
    const scores: number[] = [];
    let passCount = 0;
    let failCount = 0;
    let vetoTriggered = false;
    let vetoReason = "";

    const MAX_JUDGES = 7;

    // Create a promise that resolves when the voting is decisive
    return new Promise<VotingResult>((resolve) => {
      let completedJudges = 0;
      let resolved = false;

      const checkConsensus = () => {
        if (resolved) return;

        const criticalRoles = [3]; // Index of Security Verifier
        const criticalVotesCast = criticalRoles.every(idx =>
          judgeOutputs.some(j => j.judgeId.includes(`_${idx}`))
        );

        // Termination Conditions
        if (vetoTriggered) {
          resolved = true;
          resolve({
            round,
            judgeCount: completedJudges,
            scores,
            averageScore: 0, // Veto kills the score
            variance: 0,
            needsEscalation: false,
            requiresHumanReview: true,
            judgeOutputs
          });
          return;
        }

        // Only allow early exit if critical roles have voted
        if (criticalVotesCast) {
          if (passCount - failCount >= K_THRESHOLD) {
            resolved = true;
            const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
            resolve({
              round,
              judgeCount: completedJudges,
              scores,
              averageScore: avg,
              variance: calculateVariance(scores),
              needsEscalation: false,
              requiresHumanReview: false,
              judgeOutputs
            });
            return;
          }

          if (failCount - passCount >= K_THRESHOLD) {
            resolved = true;
            const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
            resolve({
              round,
              judgeCount: completedJudges,
              scores,
              averageScore: avg,
              variance: calculateVariance(scores),
              needsEscalation: false, // Decisive Fail
              requiresHumanReview: false,
              judgeOutputs
            });
            return;
          }
        }

        if (completedJudges >= MAX_JUDGES) {
          resolved = true;
          const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
          resolve({
            round,
            judgeCount: completedJudges,
            scores,
            averageScore: avg,
            variance: calculateVariance(scores),
            needsEscalation: true, // No consensus reached
            requiresHumanReview: false,
            judgeOutputs
          });
        }
      };

      // Launch all judges in parallel (Streaming)
      for (let i = 0; i < MAX_JUDGES; i++) {
        const role = getVerifierRole(i);
        const judgeId = `${role.id}_${i}`;

        let selectedModel = models.default;
        if (role.priority === 'critical' || round > 1) {
          selectedModel = models.advanced;
        } else if (role.priority === 'low') {
          selectedModel = models.cheap;
        }

        const runJudge = async () => {
          if (resolved) return; // Stop if already resolved

          try {
            const resp = await ai.models.generateContent({
              model: selectedModel,
              contents: `You are: ${role.persona}
                      
                      ${CONSTITUTION}
                      
                      ${originalRequirements ? `ORIGINAL REQUIREMENTS:\n"""\n${originalRequirements}\n"""\n` : ''}
                      
                      ARTIFACT TO VERIFY:
                      """
                      ${spec.substring(0, 15000)}
                      """
                      
                      TASK: ${context}
                      FOCUS: ${role.focus}
                      
                      Vote PASS (score > 70) or FAIL (score <= 70).
                      CRITICAL: If you find a FATAL flaw, issue a VETO (score 0).
                      
                      Return JSON: { "score": number, "reasoning": "short justification", "veto": boolean }`,
              config: { responseMimeType: "application/json" }
            });

            const text = resp.text || "{}";
            const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            const score = json.score || 0;
            const isVeto = json.veto === true;

            if (resolved) return; // Check again after await

            judgeOutputs.push({
              judgeId: judgeId,
              score: score,
              reasoning: json.reasoning || "No reasoning.",
              focus: role.focus
            });
            scores.push(score);
            completedJudges++;

            if (isVeto) {
              vetoTriggered = true;
              vetoReason = json.reasoning;
              failCount++;
            } else if (score > 70) {
              passCount++;
            } else {
              failCount++;
            }

            checkConsensus();

          } catch (err) {
            console.error(`Verifier ${judgeId} failed`, err);
            completedJudges++; // Count as completed (failed) so we don't hang
            checkConsensus();
          }
        };

        // Add a small stagger to avoid hitting rate limits instantly if many judges
        setTimeout(() => runJudge(), i * 500);
      }
    });
  };

  return {
    conductVoting,
    calculateVariance
  };
}

export function formatVotingResult(result: VotingResult): string {
  const lines: string[] = [];
  lines.push(`=== TRIBUNAL VERIFICATION (Round ${result.round}) ===`);
  lines.push(`Verifiers: ${result.judgeCount}`);
  lines.push(`Average Score: ${result.averageScore.toFixed(1)}/100`);
  lines.push('');
  lines.push('Individual Verdicts:');
  result.judgeOutputs.forEach((judge, idx) => {
    const verdict = judge.score > 70 ? "PASS" : "FAIL";
    const icon = judge.score > 70 ? "✅" : (judge.score === 0 ? "⛔ VETO" : "❌");
    lines.push(`  ${icon} ${judge.judgeId} (${judge.focus}): ${verdict} (${judge.score})`);
    lines.push(`     "${judge.reasoning}"`);
  });

  if (result.requiresHumanReview) {
    lines.push('\n⛔ VETO TRIGGERED - IMMEDIATE REJECTION');
  } else if (result.averageScore > 70) {
    lines.push('\n✅ VERIFIED (Consensus Reached)');
  } else {
    lines.push('\n❌ REJECTED');
  }

  return lines.join('\n');
}

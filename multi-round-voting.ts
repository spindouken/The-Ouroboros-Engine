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
    context?: string
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
      { id: 'security_verifier', label: 'Security Verifier', persona: 'You are a Security Auditor. Check for vulnerabilities and safety risks.', focus: 'Security', priority: 'critical' },
      { id: 'perf_verifier', label: 'Performance Verifier', persona: 'You are a Performance Engineer. Check for efficiency and scalability issues.', focus: 'Performance', priority: 'low' }
    ];
    return roles[index % roles.length];
  };

  const conductVoting = async (
    spec: string,
    round: number,
    ai: any,
    models: { default: string; cheap: string; advanced: string },
    context: string = "Evaluate this specification."
  ): Promise<VotingResult> => {

    const judgeOutputs: JudgeOutput[] = [];
    const scores: number[] = [];
    let passCount = 0;
    let failCount = 0;
    let vetoTriggered = false;
    let vetoReason = "";

    // We simulate a stream of up to 7 judges (or more if needed, but capped for safety)
    const MAX_JUDGES = 7;

    for (let i = 0; i < MAX_JUDGES; i++) {
      // Check termination conditions
      if (passCount - failCount >= K_THRESHOLD) break; // Pass wins
      if (failCount - passCount >= K_THRESHOLD) break; // Fail wins
      if (vetoTriggered) break;

      const role = getVerifierRole(i);
      const judgeId = `${role.id}_${i}`;

      // TIERED VOTING LOGIC
      // Use cheap model for initial rounds or low priority roles
      // Use advanced model for critical roles (Security) or later rounds
      let selectedModel = models.default;
      if (role.priority === 'critical' || round > 1) {
        selectedModel = models.advanced;
      } else if (role.priority === 'low') {
        selectedModel = models.cheap;
      }

      try {
        let attempts = 0;
        let success = false;
        let resp: any;

        while (attempts < 3 && !success) {
          try {
            resp = await ai.models.generateContent({
              model: selectedModel,
              contents: `You are: ${role.persona}
                    
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
            success = true;
          } catch (err: any) {
            if (err.message?.includes("429") || err.message?.includes("quota")) {
              console.warn(`Verifier ${judgeId} hit rate limit. Waiting 60s...`);
              await new Promise(resolve => setTimeout(resolve, 60000));
              attempts++;
            } else {
              throw err;
            }
          }
        }

        if (!success) throw new Error(`Verifier ${judgeId} failed after retries.`);

        const text = resp.text || "{}";
        const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        const score = json.score || 0;
        const isVeto = json.veto === true;

        judgeOutputs.push({
          judgeId: judgeId,
          score: score,
          reasoning: json.reasoning || "No reasoning.",
          focus: role.focus
        });
        scores.push(score);

        // CONFLICT RESOLUTION: Hierarchy of Truth
        // Security Veto overrides everything.
        if (isVeto) {
          vetoTriggered = true;
          vetoReason = json.reasoning;
          failCount++;
          // Log Disagreement Episode if others passed? (Simplified here)
        } else if (score > 70) {
          passCount++;
        } else {
          failCount++;
        }

      } catch (e) {
        console.error(`Verifier ${judgeId} failed`, e);
      }
    }

    const averageScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const variance = calculateVariance(scores);

    const passed = !vetoTriggered && (passCount > failCount);

    return {
      round,
      judgeCount: scores.length,
      scores,
      averageScore,
      variance,
      needsEscalation: !passed && !vetoTriggered,
      requiresHumanReview: vetoTriggered,
      judgeOutputs
    };
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

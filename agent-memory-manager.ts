import { AgentMemory, AgentMemoryManager, MultiRoundVotingSystem } from './types';

export class AgentMemoryManagerImpl implements AgentMemoryManager {
    private memories: Map<string, AgentMemory[]> = new Map();

    async storeMemory(agentId: string, memory: AgentMemory, ai?: any, model?: string, votingSystem?: MultiRoundVotingSystem): Promise<void> {
        // Voting on Storage: Verify memory integrity
        if (ai && model) {
            if (votingSystem) {
                try {
                    const result = await votingSystem.conductVoting(
                        memory.feedback,
                        1,
                        ai,
                        { default: model, cheap: "gemini-1.5-flash", advanced: "gemini-1.5-pro" },
                        "Verify if this memory summary is coherent, relevant, and not hallucinated."
                    );

                    if (result.averageScore <= 70 || result.requiresHumanReview) {
                        console.warn(`[Memory] Rejected memory for ${agentId} due to voting failure (Score: ${result.averageScore}).`);
                        return;
                    }
                } catch (e) {
                    console.warn("[Memory] Multi-round voting failed, falling back to simple check.", e);
                }

            } else {
                try {
                    const prompt = `
                    You are a Memory Auditor.
                    Verify if this memory summary is coherent and relevant.
                    
                    MEMORY: "${memory.feedback}"
                    SCORE: ${memory.outcomeScore}
                    
                    Vote PASS if coherent, FAIL if hallucinated or irrelevant.
                    Return JSON: { "pass": boolean }
                    `;

                    const resp = await ai.models.generateContent({
                        model: model,
                        contents: prompt,
                        config: { responseMimeType: "application/json" }
                    });

                    const text = resp.text || "{}";
                    const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

                    if (json.pass === false) {
                        console.warn(`[Memory] Rejected memory for ${agentId} due to verification failure.`);
                        return;
                    }
                } catch (e) {
                    console.warn("[Memory] Verification failed, storing anyway.", e);
                }
            }
        }

        const agentMemories = this.memories.get(agentId) || [];
        agentMemories.push(memory);
        // Sort by timestamp desc and keep top 10 (pruning)
        agentMemories.sort((a, b) => b.timestamp - a.timestamp);
        if (agentMemories.length > 10) {
            agentMemories.length = 10;
        }
        this.memories.set(agentId, agentMemories);
    }

    getMemory(agentId: string, limit: number = 5): AgentMemory[] {
        const agentMemories = this.memories.get(agentId) || [];
        return agentMemories.slice(0, limit);
    }

    injectMemoryContext(agentId: string, prompt: string): string {
        const memories = this.getMemory(agentId);
        if (memories.length === 0) return prompt;

        const memoryContext = memories.map(m =>
            `- [Cycle ${m.cycle}] (Score: ${m.outcomeScore}): ${m.feedback}`
        ).join('\n');

        return `${prompt}\n\nPAST FEEDBACK & LEARNINGS:\n${memoryContext}`;
    }

    clearMemory(agentId: string): void {
        this.memories.delete(agentId);
    }
}

export function createAgentMemoryManager(): AgentMemoryManager {
    return new AgentMemoryManagerImpl();
}

import { db } from './db/ouroborosDB';
import { AgentMemory, AgentMemoryManager, MultiRoundVotingSystem } from './types';

export class AgentMemoryManagerImpl implements AgentMemoryManager {

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

        // Store in DB
        await db.memories.add({
            ...memory,
            agentId
        });

        // Pruning: Keep top 10 by timestamp (descending)
        // Dexie doesn't have a simple "keep top N" delete, so we query and delete excess.
        const count = await db.memories.where('agentId').equals(agentId).count();
        if (count > 10) {
            const excess = await db.memories
                .where('agentId').equals(agentId)
                .reverse()
                .sortBy('timestamp');

            if (excess.length > 10) {
                const toDelete = excess.slice(10).map(m => m.id!);
                await db.memories.bulkDelete(toDelete);
            }
        }
    }

    async getMemory(agentId: string, limit: number = 5): Promise<AgentMemory[]> {
        return await db.memories
            .where('agentId').equals(agentId)
            .reverse()
            .sortBy('timestamp')
            .then(memories => memories.slice(0, limit));
    }

    async injectMemoryContext(agentId: string, prompt: string): Promise<string> {
        const memories = await this.getMemory(agentId);
        if (memories.length === 0) return prompt;

        const memoryContext = memories.map(m =>
            `- [Cycle ${m.cycle}] (Score: ${m.outcomeScore}): ${m.feedback}`
        ).join('\n');

        return `${prompt}\n\nPAST FEEDBACK & LEARNINGS:\n${memoryContext}`;
    }

    async clearMemory(agentId: string): Promise<void> {
        await db.memories.where('agentId').equals(agentId).delete();
    }
}

export function createAgentMemoryManager(): AgentMemoryManager {
    return new AgentMemoryManagerImpl();
}

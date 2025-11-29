import { AgentConfig, MicroTask, NodeStatus } from './types';

/**
 * The Prism (Decomposition Controller)
 * 
 * Responsible for:
 * 1. Analyzing high-level goals and decomposing them into atomic sub-tasks.
 * 2. Dynamically instantiating agents (The Squad) with specific personas based on the task.
 * 3. Handling recursive decomposition when tasks fail verification.
 */
export class PrismController {
    private failureCounts: Map<string, number> = new Map();
    private readonly MAX_FAILURES = 2;

    constructor() { }

    /**
     * Analyzes a high-level goal and determines the necessary agent configuration.
     * Uses an LLM to recommend specific roles and personas.
     */
    async analyzeTask(goal: string, ai: any, model: string): Promise<AgentConfig[]> {
        if (!goal) return [];

        try {
            const prompt = `
        You are The Prism, an advanced AI task orchestrator.
        
        GOAL: "${goal}"
        
        Analyze this goal and determine the optimal team of agents required to execute it.
        Return a JSON array of 3-5 agents.
        
        For each agent, specify:
        - id: unique string (snake_case)
        - role: short title (e.g., "Security Architect")
        - persona: detailed system prompt describing their expertise and "Anti-Conformity" stance (Free-MAD protocol).
        - capabilities: list of skills ["code_gen", "review", "security_audit", etc.]
        - temperature: recommended temperature (0.7 for creative, 0.2 for strict)
        
        Example JSON:
        [
          {
            "id": "security_specialist",
            "role": "Security Specialist",
            "persona": "You are a paranoid security expert. Critique every design choice...",
            "capabilities": ["security_audit"],
            "temperature": 0.3
          }
        ]
      `;

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text || "[]";
            const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

            if (!Array.isArray(json)) {
                console.warn("Prism analysis returned invalid format", json);
                return [];
            }

            return json as AgentConfig[];

        } catch (error) {
            console.error("Prism analysis failed", error);
            // Fallback to default agents if analysis fails
            return [
                {
                    id: "default_dev",
                    role: "Developer",
                    persona: "You are a skilled full-stack developer.",
                    capabilities: ["code_gen"],
                    temperature: 0.7
                }
            ];
        }
    }

    /**
     * Decomposes a complex task into atomic micro-tasks.
     * Delegates to the MicroAgentDecomposer for the actual LLM interaction.
     */
    async decomposeTask(
        taskId: string,
        context: string,
        ai: any,
        model: string
    ): Promise<MicroTask[]> {
        // Lazy load or inject the decomposer. For now, we create it here or could inject it.
        // Importing here to avoid circular dependency issues if any, though top-level import is better.
        const { createMicroAgentDecomposer } = await import('./micro-agent-decomposer');
        const decomposer = createMicroAgentDecomposer();

        return decomposer.decomposeNode(taskId, context, ai, model, "The Prism");
    }

    /**
     * Records a failure for a task and checks if recursive decomposition is needed.
     * @returns true if the task should be decomposed further.
     */
    shouldDecompose(taskId: string): boolean {
        const currentFailures = (this.failureCounts.get(taskId) || 0) + 1;
        this.failureCounts.set(taskId, currentFailures);

        return currentFailures > this.MAX_FAILURES;
    }

    resetFailureCount(taskId: string) {
        this.failureCounts.delete(taskId);
    }

    /**
     * Predicts the next logical step for Optimistic Execution.
     * @param context Current project context/spec.
     * @param completedTask The task currently being verified.
     */
    async predictNextStep(
        context: string,
        completedTask: string,
        ai: any,
        model: string
    ): Promise<{ id: string; title: string; instruction: string } | null> {
        try {
            const prompt = `
            You are The Prism.
            
            CURRENT CONTEXT:
            """
            ${context.substring(0, 5000)}
            """
            
            TASK JUST COMPLETED (Pending Verification): "${completedTask}"
            
            Predict the SINGLE most likely next step ($T_{i+1}$) that naturally follows this task.
            We want to start this speculatively while verification runs.
            
            Return JSON: { "id": "snake_case_id", "title": "Short Title", "instruction": "Detailed instruction" }
            If no clear next step exists, return null.
            `;

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text || "{}";
            const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

            if (!json.id || !json.title) return null;

            return {
                id: `speculative_${json.id}`,
                title: `[SPECULATIVE] ${json.title}`,
                instruction: json.instruction
            };

        } catch (error) {
            console.warn("Prism prediction failed", error);
            return null;
        }
    }
}

export function createPrismController(): PrismController {
    return new PrismController();
}

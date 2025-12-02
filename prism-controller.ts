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
    /**
     * Analyzes a high-level goal and determines the necessary agent configuration.
     * Uses an LLM to recommend specific roles and personas.
     */
    async analyzeTask(goal: string, ai: any, model: string, department?: string): Promise<AgentConfig[]> {
        if (!goal) return [];

        try {
            const departmentContext = department ? `FOCUS: Generate agents specifically for the "${department}" department.` : "";

            const prompt = `
        You are The Prism, an advanced AI task orchestrator.
        
        GOAL: "${goal}"
        ${departmentContext}
        
        Analyze this goal and determine the optimal team of agents required to execute it.
        Return a JSON array of 3-5 agents.
        IMPORTANT: Return ONLY the JSON array. Do not include any conversational text.
        
        **GOLD STANDARD ARCHETYPES (Use these as templates):**
        1. **The Specialist:** Highly specific domain expert (e.g., "Rust Macro Specialist", not just "Developer").
        2. **The Critic:** A dedicated dissenter who looks for flaws.
        3. **The Visionary:** Focuses on high-level alignment and future-proofing.
        
        For each agent, specify:
        - id: unique string (snake_case)
        - role: short title (Max 5 words, e.g., "PostgreSQL Optimizer")
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

            console.log(`[Prism] Analyzing task for department: ${department || 'General'} using model: ${model}`);

            const responsePromise = ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Prism Analysis Timed Out (30s)")), 30000)
            );

            const response: any = await Promise.race([responsePromise, timeoutPromise]);

            console.log(`[Prism] Analysis complete for ${department || 'General'}`);

            const text = response.text || "[]";

            // STABILITY FIX: Extract JSON from code blocks or raw text
            // This prevents "Chatty" LLM responses from breaking the parser and triggering the single-node fallback.
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
            const jsonString = jsonMatch ? jsonMatch[1] : text;

            const json = JSON.parse(jsonString.trim());

            if (!Array.isArray(json)) {
                console.warn("Prism analysis returned invalid format", json);
                return [];
            }

            // SANITIZATION: Fix swapped Role/Persona
            const sanitizedAgents = json.map((agent: any) => {
                // If role is very long (>50 chars) and persona is short (<50 chars), swap them
                if (agent.role && agent.role.length > 50 && agent.persona && agent.persona.length < 50) {
                    console.warn(`[Prism] Swapping Role/Persona for ${agent.id}`);
                    return { ...agent, role: agent.persona, persona: agent.role };
                }
                // If role is still too long, truncate it
                if (agent.role && agent.role.length > 50) {
                    agent.role = agent.role.substring(0, 47) + "...";
                }
                return agent;
            });

            return sanitizedAgents as AgentConfig[];

        } catch (error) {
            console.error("Prism analysis failed", error);
            // Fallback to default agents if analysis fails
            const dept = department || 'general';
            return [
                {
                    id: `${dept}_specialist`,
                    role: `${dept.charAt(0).toUpperCase() + dept.slice(1)} Specialist`,
                    persona: `You are a skilled ${dept} expert.`,
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
     * Analyzes a VETO reason and generates a correction plan.
     */
    async analyzeVeto(
        vetoReason: string,
        currentSpec: string,
        ai: any,
        model: string
    ): Promise<{ correctionPlan: string; suggestedAgents: AgentConfig[] }> {
        try {
            const prompt = `
            You are The Prism. A critical VETO has been issued against the current specification.
            
            VETO REASON: "${vetoReason}"
            
            CURRENT SPEC (Snippet):
            """
            ${currentSpec.substring(0, 5000)}
            """
            
            TASK:
            1. Analyze why this VETO occurred.
            2. Propose a technical alternative that solves the problem while satisfying the VETO.
            3. Recommend a "Correction Squad" (1-3 agents) to implement this fix.
            
            Return JSON:
            {
                "correctionPlan": "Detailed instruction on how to fix the spec.",
                "suggestedAgents": [
                    { "id": "fixer_1", "role": "Specific Fixer Role", "persona": "...", "capabilities": ["code_gen"], "temperature": 0.5 }
                ]
            }
            `;

            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text || "{}";
            const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

            return {
                correctionPlan: json.correctionPlan || "Fix the errors identified by the VETO.",
                suggestedAgents: json.suggestedAgents || []
            };

        } catch (error) {
            console.error("Prism Veto Analysis failed", error);
            return {
                correctionPlan: "Address the VETO reason manually.",
                suggestedAgents: []
            };
        }
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

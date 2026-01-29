/**
 * Project Insight Manager (Mid-Term Memory) - Section 5.1
 * 
 * Generates and maintains a high-level summary of architectural decisions
 * and patterns ("Project Insights") to prevent "Schizophrenic Tech Stack" issues.
 */

import { LLMResponse } from './UnifiedLLMClient';
import { extractWithPreference } from '../utils/safe-json';

export interface ProjectInsightManagerConfig {
    /** Model to use for insight generation */
    model: string;
}

export class ProjectInsightManager {
    private llmClient: {
        generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
    };

    private config: ProjectInsightManagerConfig;

    constructor(
        llmClient: {
            generateContent: (params: { model: string; contents: string; config?: any }) => Promise<LLMResponse>;
        },
        config: ProjectInsightManagerConfig
    ) {
        this.llmClient = llmClient;
        this.config = config;
    }

    /**
     * Synthesize insights from a set of verified bricks
     */
    async synthesizeInsights(
        bricks: any[],
        currentConstitution: string,
        existingInsights: string = '',
        modelOverride?: string
    ): Promise<string> {
        // Only analyze if we have a reasonable number of bricks
        if (bricks.length < 3) return existingInsights;

        const prompt = this.buildInsightPrompt(bricks.slice(-10), currentConstitution, existingInsights); // Look at last 10 bricks

        try {
            const response = await this.llmClient.generateContent({
                model: modelOverride || this.config.model,
                contents: prompt,
                config: {
                    temperature: 0.4, // Balanced for synthesis
                    maxOutputTokens: 2048
                }
            });

            // We expect the LLM to return the full updated markdown
            return response.text || existingInsights;

        } catch (error) {
            console.error('[ProjectInsightManager] Synthesis failed:', error);
            return existingInsights;
        }
    }

    private buildInsightPrompt(
        recentBricks: any[],
        constitution: string,
        existingInsights: string
    ): string {
        const bricksText = recentBricks.map(b => `### BRICK: ${b.instruction}\n${b.content}`).join('\n\n');

        return `# PROJECT INSIGHT SYNTHESIS

**Role:** You are the Project Historian and Architect.
**Goal:** Maintain a living document of "Implicit Architectural Decisions" and "Patterns" to prevent inconsistency.

---

## CURRENT CONSTITUTION
${constitution}

## EXISTING INSIGHTS (Previous Version)
${existingInsights || '(None yet)'}

## RECENT VERIFIED WORK (Last 10 Bricks)
${bricksText}

---

## YOUR TASK
Update the "Project Insights" document.
1. **Detect Implicit Decisions:** Did we chose a library (e.g., "Zod", "Axios") in the code that wasn't in the Constitution? Record it.
2. **Detect Patterns:** Are we using functional components? Classes? Specific error handling style?
3. **Consolidate:** Merge new findings with existing insights. Remove obsolete ones.

**OUTPUT FORMAT:**
Return ONLY the updated Markdown content for \`project_insights.md\`. Do not include conversational filler.

Example Output:
# Project Insights & Architecture Decisions

## Core Technology Choices
- **State Management:** Zustand (observed in Brick 4)
- **Styling:** Tailwind CSS (observed in Brick 2)

## Implementation Patterns
- All API calls must be wrapped in \`try/catch\` blocks.
- Using \`zod\` for schema validation.
`;
    }
}

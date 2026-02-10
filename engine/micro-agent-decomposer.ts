/**
 * Micro-Agent Decomposition System
 * 
 * Implements the MDAP (Massively Decomposed Agentic Processes) methodology
 * by breaking down complex tasks into atomic micro-tasks using an LLM.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type {
  MicroTask,
  MicroAgentDecomposer,
  NodeStatus
} from '../types';

export class MicroAgentDecomposerImpl implements MicroAgentDecomposer {

  /**
   * Decomposes a node into atomic micro-tasks using an LLM.
   */
  async decomposeNode(
    nodeId: string,
    context: string,
    ai: any,
    model: string,
    persona: string = "Technical Lead"
  ): Promise<MicroTask[]> {

    if (!context || context.trim().length === 0) {
      throw new Error('Context cannot be empty');
    }

    try {
      const resp = await ai.models.generateContent({
        model: model,
        contents: `You are: ${persona}.
            
            FULL SPECIFICATION / CONTEXT:
            """
            ${context.substring(0, 10000)}
            """
            
            TASK: Break this module/task down into 3-6 atomic, actionable micro-tasks.
            Each task must be specific enough to be executed by a single agent call.
            
            Return JSON Array: [{ "id": "snake_case_id", "title": "Short Title", "description": "Detailed instruction for the agent", "complexity": "Low/Medium/High" }]`,
        config: { responseMimeType: "application/json" }
      });

      const text = resp.text || "[]";

      // Hybrid Extraction: Prioritize Markdown, fallback to Brackets
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      let jsonString = "[]";

      if (jsonMatch) {
        jsonString = jsonMatch[1];
      } else {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          jsonString = text.substring(start, end + 1);
        }
      }

      let json;
      try {
        json = JSON.parse(jsonString);
      } catch (parseError) {
        console.warn("[Decomposer] JSON Parse Failed. Raw:", text);
        // Attempt to cleanup common trailing comma issues or markdown
        try {
          json = JSON.parse(jsonString.replace(/,\s*]/, "]"));
        } catch (e2) {
          return [];
        }
      }

      if (!Array.isArray(json)) {
        console.warn("Decomposition returned invalid format", json);
        return [];
      }

      return json.map((t: any, index: number) => ({
        id: `${nodeId}_task_${t.id || index}`,
        parentId: nodeId,
        instruction: t.description || t.title,
        minimalContext: t.title,
        output: null,
        confidence: 0,
        status: 'pending' as NodeStatus
      }));

    } catch (e) {
      console.error("Decomposition failed", e);
      return []; // Return empty to signal failure/fallback
    }
  }

  /**
   * Aggregates results from completed micro-tasks into a coherent output
   */
  async aggregateResults(microTasks: MicroTask[]): Promise<string> {
    if (!microTasks || microTasks.length === 0) return '';

    const completedTasks = microTasks.filter(
      task => task.output && task.output.trim().length > 0
    );

    if (completedTasks.length === 0) return '';

    // Simple aggregation for now - could be enhanced with LLM summarization later
    const sections: string[] = [];
    sections.push('# Aggregated Micro-Task Results\n');

    completedTasks.forEach(task => {
      sections.push(`## ${task.minimalContext}`);
      sections.push(task.output!);
      sections.push('');
    });

    return sections.join('\n');
  }

  calculateConfidence(microTasks: MicroTask[]): number {
    if (!microTasks || microTasks.length === 0) return 0;

    const validTasks = microTasks.filter(t => t.confidence > 0);
    if (validTasks.length === 0) return 0;

    const sum = validTasks.reduce((acc, t) => acc + t.confidence, 0);
    return sum / validTasks.length;
  }
}

export function createMicroAgentDecomposer(): MicroAgentDecomposer {
  return new MicroAgentDecomposerImpl();
}

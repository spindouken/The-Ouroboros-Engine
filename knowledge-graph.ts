import { db } from './db/ouroborosDB';
import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, KnowledgeGraphLayer } from './types';

export class KnowledgeGraphManager {

    constructor() {
    }

    /**
     * Adds a node to the Knowledge Graph with Chain of Density verification.
     */
    /**
     * Adds a node to the Knowledge Graph with Chain of Density verification.
     */
    async addNode(
        id: string,
        label: string,
        type: string,
        layer: KnowledgeGraphLayer,
        content: string,
        ai: any, // GoogleGenAI instance
        model: string,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        // Chain of Density Check
        let densityScore = await this.calculateDensity(content, ai, model);

        // Strict Enforcement: If density is low, attempt to refine.
        if (densityScore < 0.5) {
            console.warn(`[KnowledgeGraph] Low density content for node ${id}: ${densityScore}. Attempting refinement...`);

            try {
                const refinedContent = await this.refineContent(content, ai, model);
                const newScore = await this.calculateDensity(refinedContent, ai, model);

                if (newScore >= 0.5) {
                    content = refinedContent;
                    densityScore = newScore;
                    metadata.refined = true;
                } else {
                    console.warn(`[KnowledgeGraph] Content density remains low (${newScore}) after refinement. Storing with warning.`);
                    metadata.lowDensityWarning = true;
                }
            } catch (e) {
                console.error(`[KnowledgeGraph] Refinement failed for node ${id}`, e);
                metadata.refinementError = true;
            }
        }

        await db.knowledge_graph.put({
            id,
            label,
            type,
            layer,
            content,
            metadata,
            densityScore
        });
    }

    /**
     * Adds an edge between two nodes.
     */
    async addEdge(source: string, target: string, relation: string, weight: number = 1.0): Promise<void> {
        // We use the main edges table for now, distinguishing by type if needed, or just assuming 'knowledge' relation
        // However, the current schema for edges is: ++id, source, target, type.
        // We can use 'relation' as 'type'.
        await db.edges.add({ source, target, type: relation });
    }

    /**
     * Retrieves a node by ID.
     */
    async getNode(id: string): Promise<KnowledgeNode | undefined> {
        return await db.knowledge_graph.get(id);
    }

    /**
     * Queries the graph for nodes matching specific criteria.
     */
    async query(criteria: { layer?: KnowledgeGraphLayer; type?: string; labelContains?: string }): Promise<KnowledgeNode[]> {
        let collection = db.knowledge_graph.toCollection();

        if (criteria.layer) {
            collection = db.knowledge_graph.where('layer').equals(criteria.layer);
        }

        // Dexie filtering for other properties
        return await collection.filter(node => {
            if (criteria.type && node.type !== criteria.type) return false;
            if (criteria.labelContains && !node.label.toLowerCase().includes(criteria.labelContains.toLowerCase())) return false;
            return true;
        }).toArray();
    }

    /**
     * Returns the full graph state.
     */
    async getGraph(): Promise<KnowledgeGraph> {
        const nodesArr = await db.knowledge_graph.toArray();
        const nodes = nodesArr.reduce((acc, node) => ({ ...acc, [node.id]: node }), {});
        // We are not fetching edges here efficiently as they are mixed in the edges table. 
        // For now, returning empty edges or we need to query edges table.
        // Assuming we only need nodes for the "Blackboard" view usually.
        return { nodes, edges: [] };
    }

    /**
     * Clears the graph (e.g., for new session).
     */
    async clear(): Promise<void> {
        await db.knowledge_graph.clear();
        // Also clear edges if we were storing them specifically for KG
    }

    /**
     * Refines content to increase information density.
     */
    private async refineContent(content: string, ai: any, model: string): Promise<string> {
        try {
            const resp = await ai.models.generateContent({
                model: model,
                contents: `You are a Technical Editor.
                The following content has LOW INFORMATION DENSITY (too much fluff, not enough concrete details).
                
                CONTENT:
                """
                ${content.substring(0, 5000)}
                """
                
                TASK: Rewrite this content to be "Dense" and "Crisp".
                - Remove hedging ("I think", "maybe").
                - Add specific named entities, version numbers, or constraints if implied.
                - Keep it concise but technically rich.
                
                Return ONLY the refined markdown string.`
            });
            return resp.text || content;
        } catch (e) {
            console.error("Content refinement failed", e);
            return content;
        }
    }

    /**
     * Calculates a density score using the LLM.
     * Checks for Named Entities, Constraints, and Information Density.
     */
    private async calculateDensity(content: string, ai: any, model: string): Promise<number> {
        if (!content || content.length < 50) return 0.1;

        try {
            const resp = await ai.models.generateContent({
                model: model,
                contents: `You are a Knowledge Graph Auditor.
                Analyze the following content for "Information Density".
                
                CONTENT:
                """
                ${content.substring(0, 2000)}
                """
                
                Criteria for High Density:
                1. High ratio of Named Entities (specific tools, technologies, modules).
                2. Concrete constraints (numbers, versions, specific limits).
                3. Absence of "fluff" (hedging, filler words, generic statements).
                
                Return a JSON object: { "score": number (0.0 - 1.0), "reason": "string" }`
            });

            const text = resp.text || "{}";
            const json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            return json.score || 0.5;
        } catch (e) {
            console.error("Density check failed", e);
            return 0.5; // Fallback
        }
    }

    /**
     * Serializes the graph for storage.
     */
    async serialize(): Promise<string> {
        const graph = await this.getGraph();
        return JSON.stringify(graph);
    }

    /**
     * Deserializes a graph from storage.
     */
    async deserialize(json: string): Promise<void> {
        const graph: KnowledgeGraph = JSON.parse(json);
        await db.transaction('rw', db.knowledge_graph, async () => {
            await db.knowledge_graph.clear();
            await db.knowledge_graph.bulkPut(Object.values(graph.nodes));
        });
    }
}

export const createKnowledgeGraphManager = () => new KnowledgeGraphManager();

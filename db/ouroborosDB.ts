import Dexie, { Table } from 'dexie';
import { Node, LogEntry, AgentMemory, AppSettings, KnowledgeNode, PlanItem, OracleMessage, OracleContext } from '../types';

// Define interfaces for our tables
// We extend existing types where possible to maintain consistency with the application

export interface DBNode extends Node {
    // Inherits id: string from Node
    // We add timestamp if it's not in Node (it's not in the interface shown in types.ts, but might be in data)
    timestamp?: number;
}

export interface DBEdge {
    id?: number; // Auto-incrementing ID for the DB record
    source: string; // References Node.id
    target: string; // References Node.id
    type?: string;
}

export interface DBLog extends LogEntry {
    // Inherits id: string from LogEntry
}

export interface DBKnowledgeNode extends KnowledgeNode {
    // Inherits id: string from KnowledgeNode
}

export interface DBMemory extends AgentMemory {
    id?: number; // Auto-incrementing ID
    agentId: string; // The agent/persona this memory belongs to
}

export interface DBProject {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;

    // --- Store State ---
    documentContent: string;
    projectPlan: PlanItem[];
    manifestation?: string | null;
    council: any;
    oracle: {
        history: OracleMessage[];
        clarityScore: number;
        isActive: boolean;
        fusedContext: OracleContext | null; // OracleContext from types
    };

    // --- Graph State ---
    nodes: DBNode[];
    edges: DBEdge[];
    logs: DBLog[];
}

export interface DBSettings extends AppSettings {
    id?: number; // Singleton, usually 1
    apiKey?: string; // Ensure apiKey is part of settings, optional
}

export class OuroborosDB extends Dexie {
    nodes!: Table<DBNode>;
    edges!: Table<DBEdge>;
    logs!: Table<DBLog>;
    knowledge_graph!: Table<DBKnowledgeNode>;
    memories!: Table<DBMemory>;
    projects!: Table<DBProject>;
    settings!: Table<DBSettings>;

    constructor() {
        super('OuroborosDB');
        this.version(1).stores({
            // Using 'id' (string) for nodes to match existing UUID usage in the engine.
            nodes: 'id, type, status, parentId, timestamp, [type+status]',

            edges: '++id, source, target, type',

            // Using 'id' (string) for logs to match existing ID usage.
            logs: 'id, timestamp, level, nodeId',

            knowledge_graph: 'id, label, type, layer, densityScore',

            memories: '++id, agentId, cycle, outcomeScore, timestamp, [agentId+timestamp]',

            projects: 'id, name, createdAt, updatedAt',

            settings: '++id'
        });
    }
}

export const db = new OuroborosDB();

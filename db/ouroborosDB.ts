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

// ============================================================================
// V2.99 INCREMENTAL CHECKPOINT TYPES (Inline to avoid circular imports)
// ============================================================================

export type DBSessionPhase =
    | 'idle'
    | 'genesis_started'
    | 'genesis_complete'
    | 'prism_step_a'
    | 'prism_step_b'
    | 'prism_step_c'
    | 'saboteur_complete'
    | 'awaiting_review'
    | 'execution_started'
    | 'execution_in_progress'
    | 'complete';

export interface DBCheckpointMeta {
    phase: DBSessionPhase;
    timestamp: number;
    checkpointVersion: string;
    totalSteps: number;
    completedSteps: number;
    totalNodes?: number;
    completedNodeIds?: string[];
    currentNodeId?: string;
    lastError?: string;
    retryCount?: number;
    description: string;
}

export interface DBNodeExecutionState {
    completedNodes: Array<{
        nodeId: string;
        output: any;
        completedAt: number;
    }>;
    failedNodes: Array<{
        nodeId: string;
        error: string;
        failedAt: number;
        retries: number;
    }>;
}

export interface DBGenesisResultSnapshot {
    constitution: any;
    domain: string;
    techStack: string[];
    constraints: string[];
}

export interface DBPrismStepASnapshot {
    domain: string;
    subDomain?: string;
    confidence: number;
    expertiseAreas: string[];
}

export interface DBPrismStepBSnapshot {
    council: any;
    atomicTasks: any[];
}

export interface DBPrismStepCSnapshot {
    routedTasks: any[];
    fastPathCount: number;
    slowPathCount: number;
}

export interface DBSaboteurResultSnapshot {
    gapsInjected: number;
    modifiedTasks: any[];
}

// ============================================================================
// DB PROJECT INTERFACE
// ============================================================================

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

    // --- V2.99 State (Pragmatic Brick Factory) ---
    prismAnalysis?: any; // Full Prism result: stepA, stepB, stepC, stepD
    livingConstitution?: any; // Domain, techStack, constraints, decisions, warnings
    verifiedBricks?: any[]; // All verified brick artifacts

    // Usage Metrics (New)
    usageMetrics?: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; requestCount: number }>;

    // --- V2.99 Incremental Checkpoint System ---
    checkpoint?: DBCheckpointMeta;
    genesisResult?: DBGenesisResultSnapshot;
    prismStepAResult?: DBPrismStepASnapshot;
    prismStepBResult?: DBPrismStepBSnapshot;
    prismStepCResult?: DBPrismStepCSnapshot;
    saboteurResult?: DBSaboteurResultSnapshot;
    nodeExecutionState?: DBNodeExecutionState;

    // --- Graph State ---
    nodes: DBNode[];
    edges: DBEdge[];
    logs: DBLog[];
}

export interface DBSettings extends AppSettings {
    id?: number; // Singleton, usually 1
    apiKey?: string; // Ensure apiKey is part of settings, optional
}

/**
 * Skill Entry for Golden Seed Vector DB (Section 3.2)
 * Pre-validated templates and competencies for Senior-level output from Day 1
 */
export interface DBSkill {
    id: string;
    name: string;
    category: string; // e.g., 'React', 'Authentication', 'API Design'
    tags: string[]; // For vector search matching
    content: string; // The actual skill template/pattern
    source: 'golden_seed' | 'learned'; // Genesis Protocol or learned via Memory
    createdAt: number;
    usageCount: number;
}

/**
 * Project Stack Template for Verified Templates UI (Section 2.2)
 * Pre-configured tech stacks like "React + Vite + Supabase"
 */
export interface DBProjectStack {
    id: string;
    name: string; // e.g., "React + Vite + Supabase"
    description: string;
    techStack: {
        frontend?: string[];
        backend?: string[];
        database?: string[];
        auth?: string[];
        hosting?: string[];
    };
    preloadSkills: string[]; // Skill IDs to inject on selection
    constraints: string[]; // Default constraints for this stack
    isBuiltIn: boolean;
    createdAt: number;
}

export class OuroborosDB extends Dexie {
    nodes!: Table<DBNode>;
    edges!: Table<DBEdge>;
    logs!: Table<DBLog>;
    knowledge_graph!: Table<DBKnowledgeNode>;
    memories!: Table<DBMemory>;
    projects!: Table<DBProject>;
    settings!: Table<DBSettings>;
    skills!: Table<DBSkill>; // Golden Seed Vector DB (Section 3.2)
    project_stacks!: Table<DBProjectStack>; // Verified Templates (Section 2.2)

    constructor() {
        super('OuroborosDB');

        // Version 1: Original schema
        this.version(1).stores({
            nodes: 'id, type, status, parentId, timestamp, [type+status]',
            edges: '++id, source, target, type',
            logs: 'id, timestamp, level, nodeId',
            knowledge_graph: 'id, label, type, layer, densityScore',
            memories: '++id, agentId, cycle, outcomeScore, timestamp, [agentId+timestamp]',
            projects: 'id, name, createdAt, updatedAt',
            settings: '++id'
        });

        // Version 2: V2.99 additions - Skills and Project Stacks
        this.version(2).stores({
            nodes: 'id, type, status, parentId, timestamp, [type+status]',
            edges: '++id, source, target, type',
            logs: 'id, timestamp, level, nodeId',
            knowledge_graph: 'id, label, type, layer, densityScore',
            memories: '++id, agentId, cycle, outcomeScore, timestamp, [agentId+timestamp]',
            projects: 'id, name, createdAt, updatedAt',
            settings: '++id',
            skills: 'id, name, category, *tags, source, createdAt, usageCount',
            project_stacks: 'id, name, isBuiltIn, createdAt'
        });

        // Version 3: V2.99 ReCAP - Recursive Context-Aware Planning
        // Adds depth and decompositionStatus for efficient tree traversing
        this.version(3).stores({
            nodes: 'id, type, status, parentId, depth, decompositionStatus, timestamp, [type+status], [parentId+depth]',
            edges: '++id, source, target, type',
            logs: 'id, timestamp, level, nodeId',
            knowledge_graph: 'id, label, type, layer, densityScore',
            memories: '++id, agentId, cycle, outcomeScore, timestamp, [agentId+timestamp]',
            projects: 'id, name, createdAt, updatedAt',
            settings: '++id',
            skills: 'id, name, category, *tags, source, createdAt, usageCount',
            project_stacks: 'id, name, isBuiltIn, createdAt'
        });
    }
}

export const db = new OuroborosDB();

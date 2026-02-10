// ============================================================================
// OUROBOROS V2.99 - INCREMENTAL CHECKPOINT SYSTEM
// ============================================================================
// This file contains all types and the CheckpointManager class for the
// Incremental Checkpoint & Resume System. Enables crash recovery, pause/resume,
// and rollback to any checkpoint within a session.
// 
// Reference: V2.99_Checkpoint_Resume_Implementation_Plan.md
// ============================================================================
// █ ANCHOR 3: CHECKPOINT MANAGER (Time Machine)
// 1. Session Phases (Finite State Machine)
// 2. Metadata Structure
// 3. Non-blocking Save (Microtask)
// 4. Auto-Resume Detection
// ============================================================================

import { db } from '../db/ouroborosDB';
import { useOuroborosStore } from '../store/ouroborosStore';

// Type alias for partial project data to avoid circular import with DBProject
type PartialProjectData = Record<string, any>;

// ============================================================================
// SESSION PHASE ENUM
// ============================================================================
// Represents the discrete phases of the Ouroboros pipeline.
// Each phase is a checkpoint where state can be saved and restored.

export enum SessionPhase {
    // █ ANCHOR 3.1: Finite State Machine (Phases)
    IDLE = 'idle',                           // Not started
    GENESIS_STARTED = 'genesis_started',     // Genesis Protocol in progress
    GENESIS_COMPLETE = 'genesis_complete',   // Constitution ready
    PRISM_STEP_A = 'prism_step_a',           // Domain classification done
    PRISM_STEP_B = 'prism_step_b',           // Tasks generated
    PRISM_STEP_C = 'prism_step_c',           // Routing complete
    SABOTEUR_COMPLETE = 'saboteur_complete', // Gaps filled
    AWAITING_REVIEW = 'awaiting_review',     // Setup done, waiting for user
    EXECUTION_STARTED = 'execution_started', // Execution phase begins
    EXECUTION_IN_PROGRESS = 'execution_in_progress', // Nodes being processed
    COMPLETE = 'complete'                    // All done
}

// ============================================================================
// CHECKPOINT METADATA
// ============================================================================
// Metadata stored with each checkpoint for progress tracking and recovery.

export interface CheckpointMeta {
    // █ ANCHOR 3.2: Checkpoint Metadata
    phase: SessionPhase;
    timestamp: number;
    checkpointVersion: string;  // Schema version for future migrations

    // Progress tracking
    totalSteps: number;
    completedSteps: number;

    // Execution-specific (only during node execution)
    totalNodes?: number;
    completedNodeIds?: string[];
    currentNodeId?: string;

    // Error recovery
    lastError?: string;
    retryCount?: number;

    // Human-readable description
    description: string;
}

// ============================================================================
// INTERMEDIATE STATE SNAPSHOTS
// ============================================================================
// Data structures for saving intermediate pipeline results.

export interface GenesisResultSnapshot {
    constitution: any;
    domain: string;
    techStack: string[];
    constraints: string[];
}

export interface PrismStepASnapshot {
    domain: string;
    subDomain?: string;
    confidence: number;
    expertiseAreas: string[];
}

export interface PrismStepBSnapshot {
    council: any;
    atomicTasks: any[];
}

export interface PrismStepCSnapshot {
    routedTasks: any[];
    fastPathCount: number;
    slowPathCount: number;
}

export interface SaboteurResultSnapshot {
    gapsInjected: number;
    modifiedTasks: any[];
}

export interface NodeExecutionState {
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

// ============================================================================
// SESSION CHECKPOINT
// ============================================================================
// A full checkpoint within a named session, containing all state at that point.

export interface SessionCheckpoint {
    id: string;
    timestamp: number;
    phase: SessionPhase;
    description: string;

    // Full state snapshot
    livingConstitution: any;
    prismAnalysis: any;
    verifiedBricks: any[];
    nodeExecutionState?: NodeExecutionState;

    // Intermediate results
    genesisResult?: GenesisResultSnapshot;
    prismStepAResult?: PrismStepASnapshot;
    prismStepBResult?: PrismStepBSnapshot;
    prismStepCResult?: PrismStepCSnapshot;
    saboteurResult?: SaboteurResultSnapshot;
}

// ============================================================================
// NAMED SESSION
// ============================================================================
// A user-created session with full checkpoint history and rollback capability.

export interface NamedSession {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;

    // Multiple checkpoints (newest first)
    checkpoints: SessionCheckpoint[];  // Max 10 per session

    // Current active checkpoint index
    activeCheckpointIndex: number;

    // Core data (shared across checkpoints)
    originalRequirements: string;

    // Metadata
    totalRuns: number;
    lastPhase: SessionPhase;
}

// ============================================================================
// PHASE UTILITIES
// ============================================================================
// Helper functions for working with session phases.

const PHASE_ORDER: SessionPhase[] = [
    SessionPhase.IDLE,
    SessionPhase.GENESIS_STARTED,
    SessionPhase.GENESIS_COMPLETE,
    SessionPhase.PRISM_STEP_A,
    SessionPhase.PRISM_STEP_B,
    SessionPhase.PRISM_STEP_C,
    SessionPhase.SABOTEUR_COMPLETE,
    SessionPhase.AWAITING_REVIEW,
    SessionPhase.EXECUTION_STARTED,
    SessionPhase.EXECUTION_IN_PROGRESS,
    SessionPhase.COMPLETE
];

const PHASE_DESCRIPTIONS: Record<SessionPhase, string> = {
    [SessionPhase.IDLE]: 'Not started',
    [SessionPhase.GENESIS_STARTED]: 'Generating Constitution...',
    [SessionPhase.GENESIS_COMPLETE]: 'Constitution ready',
    [SessionPhase.PRISM_STEP_A]: 'Domain classified',
    [SessionPhase.PRISM_STEP_B]: 'Tasks generated',
    [SessionPhase.PRISM_STEP_C]: 'Tasks routed',
    [SessionPhase.SABOTEUR_COMPLETE]: 'Gaps filled',
    [SessionPhase.AWAITING_REVIEW]: 'Awaiting your review',
    [SessionPhase.EXECUTION_STARTED]: 'Execution started',
    [SessionPhase.EXECUTION_IN_PROGRESS]: 'Executing tasks...',
    [SessionPhase.COMPLETE]: 'Complete'
};

/**
 * Compare two phases to determine order.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function comparePhases(a: SessionPhase, b: SessionPhase): number {
    return PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b);
}

/**
 * Check if a phase indicates a resumable state.
 */
export function isResumablePhase(phase: SessionPhase): boolean {
    return phase !== SessionPhase.IDLE && phase !== SessionPhase.COMPLETE;
}

/**
 * Calculate the total number of steps for progress tracking.
 */
function calculateTotalSteps(phase: SessionPhase): number {
    // Base pipeline has 8 steps (Genesis through Complete)
    return 8;
}

/**
 * Calculate completed steps based on current phase.
 */
function calculateCompletedSteps(phase: SessionPhase): number {
    const index = PHASE_ORDER.indexOf(phase);
    // IDLE = 0, GENESIS_COMPLETE = 2, etc.
    return Math.max(0, index);
}

// ============================================================================
// CHECKPOINT MANAGER
// ============================================================================
// The main class for managing checkpoints, saving state, and handling resume.

export class CheckpointManager {
    private currentPhase: SessionPhase = SessionPhase.IDLE;
    private sessionId: string;
    private autoSaveEnabled: boolean = true;

    // Static singleton instance
    private static instance: CheckpointManager | null = null;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    /**
     * Get or create the singleton CheckpointManager instance.
     */
    static getInstance(sessionId?: string): CheckpointManager {
        if (!CheckpointManager.instance) {
            const id = sessionId || useOuroborosStore.getState().currentSessionId || 'current_session';
            CheckpointManager.instance = new CheckpointManager(id);
        }
        return CheckpointManager.instance;
    }

    /**
     * Reset the singleton instance (for testing or new sessions).
     */
    static resetInstance(): void {
        CheckpointManager.instance = null;
    }

    /**
     * Get the current session ID.
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Set a new session ID.
     */
    setSessionId(sessionId: string): void {
        this.sessionId = sessionId;
    }

    /**
     * Get the current phase.
     */
    getCurrentPhase(): SessionPhase {
        return this.currentPhase;
    }

    /**
     * Enable or disable auto-save.
     */
    setAutoSaveEnabled(enabled: boolean): void {
        this.autoSaveEnabled = enabled;
    }

    /**
     * Save a checkpoint at the current phase.
     * Uses queueMicrotask for non-blocking save.
     * 
     * @param phase - The pipeline phase being checkpointed
     * @param data - Partial DBProject data to merge into the save
     * @param description - Optional custom description
     */
    async checkpoint(
        phase: SessionPhase,
        data: PartialProjectData,
        description?: string
    ): Promise<void> {
        // █ ANCHOR 3.3: Non-blocking Save Mechanism (queueMicrotask)
        if (!this.autoSaveEnabled) {
            console.log(`[Checkpoint] Auto-save disabled, skipping: ${phase}`);
            return;
        }

        this.currentPhase = phase;

        const meta: CheckpointMeta = {
            phase,
            timestamp: Date.now(),
            checkpointVersion: '1.0.0',
            totalSteps: calculateTotalSteps(phase),
            completedSteps: calculateCompletedSteps(phase),
            description: description || PHASE_DESCRIPTIONS[phase]
        };

        // Extract execution-specific metadata if present
        if (data.nodeExecutionState) {
            const execState = data.nodeExecutionState as NodeExecutionState;
            meta.completedNodeIds = execState.completedNodes.map(n => n.nodeId);
            meta.totalNodes = data.nodes?.length || 0;
            if (execState.completedNodes.length > 0) {
                meta.currentNodeId = execState.completedNodes[execState.completedNodes.length - 1].nodeId;
            }
        }

        // Non-blocking save using queueMicrotask
        queueMicrotask(async () => {
            try {
                await db.projects.update(this.sessionId, {
                    checkpoint: meta,
                    ...data,
                    updatedAt: Date.now()
                } as any);
                console.log(`[Checkpoint] ✓ Saved: ${phase} - ${meta.description}`);
            } catch (error) {
                console.error(`[Checkpoint] ✗ Failed to save: ${phase}`, error);
            }
        });
    }

    /**
     * Save a checkpoint synchronously (blocks until save completes).
     * Use for critical saves where you need confirmation.
     */
    async checkpointSync(
        phase: SessionPhase,
        data: PartialProjectData,
        description?: string
    ): Promise<boolean> {
        this.currentPhase = phase;

        const meta: CheckpointMeta = {
            phase,
            timestamp: Date.now(),
            checkpointVersion: '1.0.0',
            totalSteps: calculateTotalSteps(phase),
            completedSteps: calculateCompletedSteps(phase),
            description: description || PHASE_DESCRIPTIONS[phase]
        };

        try {
            await db.projects.update(this.sessionId, {
                checkpoint: meta,
                ...data,
                updatedAt: Date.now()
            } as any);
            console.log(`[Checkpoint] ✓ Saved (sync): ${phase}`);
            return true;
        } catch (error) {
            console.error(`[Checkpoint] ✗ Failed to save (sync): ${phase}`, error);
            return false;
        }
    }

    /**
     * Check if a session can be resumed.
     * 
     * @param sessionId - The session ID to check
     * @returns Resume capability info
     */
    async canResume(sessionId?: string): Promise<{
        resumable: boolean;
        phase: SessionPhase;
        description: string;
        timestamp?: number;
        completedSteps?: number;
        totalSteps?: number;
    }> {
        const id = sessionId || this.sessionId;

        try {
            const project = await db.projects.get(id);

            if (!project) {
                return {
                    resumable: false,
                    phase: SessionPhase.IDLE,
                    description: 'Session not found'
                };
            }

            const checkpoint = (project as any).checkpoint as CheckpointMeta | undefined;

            if (!checkpoint) {
                return {
                    resumable: false,
                    phase: SessionPhase.IDLE,
                    description: 'No checkpoint found'
                };
            }

            const isResumable = isResumablePhase(checkpoint.phase);

            return {
                resumable: isResumable,
                phase: checkpoint.phase,
                description: checkpoint.description || PHASE_DESCRIPTIONS[checkpoint.phase],
                timestamp: checkpoint.timestamp,
                completedSteps: checkpoint.completedSteps,
                totalSteps: checkpoint.totalSteps
            };
        } catch (error) {
            console.error('[Checkpoint] Error checking resume capability:', error);
            return {
                resumable: false,
                phase: SessionPhase.IDLE,
                description: 'Error checking session'
            };
        }
    }

    /**
     * Get the checkpoint metadata for a session.
     */
    async getCheckpointMeta(sessionId?: string): Promise<CheckpointMeta | null> {
        const id = sessionId || this.sessionId;

        try {
            const project = await db.projects.get(id);
            return (project as any)?.checkpoint || null;
        } catch (error) {
            console.error('[Checkpoint] Error getting checkpoint meta:', error);
            return null;
        }
    }

    /**
     * Get human-readable phase description.
     */
    getPhaseDescription(phase: SessionPhase): string {
        return PHASE_DESCRIPTIONS[phase] || 'Unknown phase';
    }

    /**
     * Get progress percentage based on phase.
     */
    getProgressPercentage(phase: SessionPhase): number {
        const completed = calculateCompletedSteps(phase);
        const total = calculateTotalSteps(phase);
        return Math.round((completed / total) * 100);
    }

    /**
     * Clear the checkpoint for a session (mark as complete or reset).
     */
    async clearCheckpoint(sessionId?: string): Promise<void> {
        const id = sessionId || this.sessionId;

        try {
            await db.projects.update(id, {
                checkpoint: undefined,
                updatedAt: Date.now()
            } as any);
            this.currentPhase = SessionPhase.IDLE;
            console.log(`[Checkpoint] Cleared checkpoint for session: ${id}`);
        } catch (error) {
            console.error('[Checkpoint] Error clearing checkpoint:', error);
        }
    }

    /**
     * Mark the session as complete.
     */
    async markComplete(): Promise<void> {
        await this.checkpointSync(
            SessionPhase.COMPLETE,
            {},
            'Pipeline complete'
        );
    }

    /**
     * Save a checkpoint for a paused execution.
     */
    async saveOnPause(nodeExecutionState: NodeExecutionState): Promise<void> {
        await this.checkpointSync(
            SessionPhase.EXECUTION_IN_PROGRESS,
            { nodeExecutionState } as any,
            `Paused after ${nodeExecutionState.completedNodes.length} nodes`
        );
    }
}

// ============================================================================
// RESUME DETECTION
// ============================================================================
// Helper function for detecting resumable sessions on app load.

/**
 * Check if there's a resumable auto-save session.
 * Returns the session info if resumable, null otherwise.
 */
export async function detectResumableSession(): Promise<{
    // █ ANCHOR 3.4: Auto-Resume Detection
    sessionId: string;
    phase: SessionPhase;
    description: string;
    timestamp: number;
    progress: number;
} | null> {
    try {
        const project = await db.projects.get('current_session');

        if (!project) {
            return null;
        }

        const checkpoint = (project as any).checkpoint as CheckpointMeta | undefined;

        if (!checkpoint || !isResumablePhase(checkpoint.phase)) {
            return null;
        }

        return {
            sessionId: 'current_session',
            phase: checkpoint.phase,
            description: checkpoint.description || PHASE_DESCRIPTIONS[checkpoint.phase],
            timestamp: checkpoint.timestamp,
            progress: Math.round((checkpoint.completedSteps / checkpoint.totalSteps) * 100)
        };
    } catch (error) {
        console.error('[Checkpoint] Error detecting resumable session:', error);
        return null;
    }
}

/**
 * Format a timestamp relative to now (e.g., "10 minutes ago").
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

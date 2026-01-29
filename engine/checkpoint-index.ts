// ============================================================================
// CHECKPOINT MODULE EXPORTS
// ============================================================================
// Centralized exports for the V2.99 Incremental Checkpoint System
// ============================================================================

export {
    // Core Classes
    CheckpointManager,

    // Enums
    SessionPhase,

    // Types
    type CheckpointMeta,
    type GenesisResultSnapshot,
    type PrismStepASnapshot,
    type PrismStepBSnapshot,
    type PrismStepCSnapshot,
    type SaboteurResultSnapshot,
    type NodeExecutionState,
    type SessionCheckpoint,
    type NamedSession,

    // Utility Functions
    comparePhases,
    isResumablePhase,
    detectResumableSession,
    formatRelativeTime
} from './checkpoint';

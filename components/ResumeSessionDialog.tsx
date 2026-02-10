import React from 'react';
import { SessionPhase, formatRelativeTime } from '../engine/checkpoint';

// ============================================================================
// RESUME SESSION DIALOG
// ============================================================================
// A modal dialog that appears on app load if a resumable session is detected.
// Allows users to resume their previous session or start fresh.
//
// Reference: V2.99_Checkpoint_Resume_Implementation_Plan.md (Task 7)
// ============================================================================

interface ResumeSessionDialogProps {
    isOpen: boolean;
    phase: SessionPhase;
    description: string;
    timestamp: number;
    progress: number;
    taskCount?: number;
    onResume: () => void;
    onStartFresh: () => void;
    onClose: () => void;
}

/**
 * Get an emoji icon for each phase
 */
function getPhaseIcon(phase: SessionPhase): string {
    switch (phase) {
        case SessionPhase.GENESIS_STARTED:
        case SessionPhase.GENESIS_COMPLETE:
            return '📜';
        case SessionPhase.PRISM_STEP_A:
        case SessionPhase.PRISM_STEP_B:
        case SessionPhase.PRISM_STEP_C:
            return '🔮';
        case SessionPhase.SABOTEUR_COMPLETE:
            return '🎭';
        case SessionPhase.AWAITING_REVIEW:
            return '👁️';
        case SessionPhase.EXECUTION_STARTED:
        case SessionPhase.EXECUTION_IN_PROGRESS:
            return '⚙️';
        case SessionPhase.COMPLETE:
            return '✅';
        default:
            return '📁';
    }
}

/**
 * Get a human-friendly phase name
 */
function getPhaseName(phase: SessionPhase): string {
    switch (phase) {
        case SessionPhase.GENESIS_STARTED:
            return 'Generating Constitution';
        case SessionPhase.GENESIS_COMPLETE:
            return 'Constitution Ready';
        case SessionPhase.PRISM_STEP_A:
            return 'Domain Classification';
        case SessionPhase.PRISM_STEP_B:
            return 'Tasks Generated';
        case SessionPhase.PRISM_STEP_C:
            return 'Routing Complete';
        case SessionPhase.SABOTEUR_COMPLETE:
            return 'Gaps Identified';
        case SessionPhase.AWAITING_REVIEW:
            return 'Ready for Review';
        case SessionPhase.EXECUTION_STARTED:
            return 'Execution Starting';
        case SessionPhase.EXECUTION_IN_PROGRESS:
            return 'Execution In Progress';
        default:
            return 'Unknown Phase';
    }
}

export const ResumeSessionDialog: React.FC<ResumeSessionDialogProps> = ({
    isOpen,
    phase,
    description,
    timestamp,
    progress,
    taskCount,
    onResume,
    onStartFresh,
    onClose
}) => {
    if (!isOpen) return null;

    const phaseIcon = getPhaseIcon(phase);
    const phaseName = getPhaseName(phase);
    const relativeTime = formatRelativeTime(timestamp);

    return (
        <div style={styles.overlay}>
            <div style={styles.dialog}>
                {/* Header */}
                <div style={styles.header}>
                    <span style={styles.headerIcon}>📁</span>
                    <h2 style={styles.headerTitle}>Resume Previous Session?</h2>
                    <button
                        style={styles.closeButton}
                        onClick={onClose}
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    <p style={styles.description}>
                        You have an incomplete session that can be resumed:
                    </p>

                    {/* Phase Info */}
                    <div style={styles.phaseCard}>
                        <div style={styles.phaseHeader}>
                            <span style={styles.phaseIcon}>{phaseIcon}</span>
                            <div style={styles.phaseInfo}>
                                <div style={styles.phaseName}>{phaseName}</div>
                                <div style={styles.phaseDescription}>{description}</div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={styles.progressContainer}>
                            <div style={styles.progressBar}>
                                <div
                                    style={{
                                        ...styles.progressFill,
                                        width: `${progress}%`
                                    }}
                                />
                            </div>
                            <span style={styles.progressText}>{progress}%</span>
                        </div>

                        {/* Meta Info */}
                        <div style={styles.metaRow}>
                            <span style={styles.metaItem}>
                                🕐 Last updated: <strong>{relativeTime}</strong>
                            </span>
                            {taskCount !== undefined && (
                                <span style={styles.metaItem}>
                                    📝 {taskCount} tasks pending
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={styles.actions}>
                    <button
                        style={styles.resumeButton}
                        onClick={onResume}
                    >
                        <span style={styles.buttonIcon}>▶️</span>
                        Resume Session
                    </button>
                    <button
                        style={styles.freshButton}
                        onClick={onStartFresh}
                    >
                        <span style={styles.buttonIcon}>🔄</span>
                        Start Fresh
                    </button>
                </div>

                {/* Footer Note */}
                <p style={styles.footerNote}>
                    💡 Resuming will continue from your last checkpoint, preserving all progress.
                </p>
            </div>
        </div>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'flex-start', // Moved from center to flex-start
        justifyContent: 'center',
        paddingTop: '120px', // Push down below node counter
        zIndex: 9999,
        backdropFilter: 'blur(8px)',
    },
    dialog: {
        backgroundColor: '#030303', // Darker canvas
        borderRadius: '12px',
        border: '1px solid #10b981', // Emerald border
        boxShadow: '0 0 40px rgba(16, 185, 129, 0.2)', // Emerald glow
        maxWidth: '480px',
        width: '90%',
        overflow: 'hidden',
        animation: 'slideDown 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)', // Animation
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
        background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.1), transparent)',
    },
    headerIcon: {
        fontSize: '24px',
    },
    headerTitle: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 700,
        fontFamily: 'monospace', // Cyberpunk font
        color: '#ecfdf5',
        flex: 1,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    },
    closeButton: {
        background: 'transparent',
        border: 'none',
        color: '#10b981',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'all 0.2s',
    },
    content: {
        padding: '24px',
    },
    description: {
        margin: '0 0 20px 0',
        color: '#9ca3af',
        fontSize: '14px',
        lineHeight: 1.6,
        fontFamily: 'monospace',
    },
    phaseCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid rgba(16, 185, 129, 0.2)',
    },
    phaseHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '16px',
    },
    phaseIcon: {
        fontSize: '32px',
        lineHeight: 1,
    },
    phaseInfo: {
        flex: 1,
    },
    phaseName: {
        fontSize: '14px',
        fontWeight: 700,
        color: '#10b981',
        marginBottom: '4px',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
    },
    phaseDescription: {
        fontSize: '12px',
        color: '#6ee7b7',
    },
    progressContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
    },
    progressBar: {
        flex: 1,
        height: '4px',
        backgroundColor: '#064e3b',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: '#10b981',
        borderRadius: '2px',
        transition: 'width 0.3s ease',
        boxShadow: '0 0 10px #10b981',
    },
    progressText: {
        fontSize: '12px',
        fontWeight: 700,
        color: '#10b981',
        minWidth: '40px',
        textAlign: 'right' as const,
        fontFamily: 'monospace',
    },
    metaRow: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '16px',
    },
    metaItem: {
        fontSize: '11px',
        color: '#6b7280',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
    },
    actions: {
        display: 'flex',
        gap: '12px',
        padding: '0 24px',
    },
    resumeButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '14px 20px',
        fontSize: '12px',
        fontWeight: 700,
        border: '1px solid #10b981',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#10b981',
        fontFamily: 'monospace',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)',
    },
    freshButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '14px 20px',
        fontSize: '12px',
        fontWeight: 700,
        border: '1px solid #374151',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: 'transparent',
        color: '#6b7280',
        fontFamily: 'monospace',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
    },
    buttonIcon: {
        fontSize: '14px',
    },
    footerNote: {
        margin: 0,
        padding: '16px 24px 20px',
        fontSize: '11px',
        color: '#4b5563',
        textAlign: 'center' as const,
        fontFamily: 'monospace',
    },
};

export default ResumeSessionDialog;

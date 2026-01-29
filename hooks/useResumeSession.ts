import { useState, useEffect, useCallback } from 'react';
import {
    CheckpointManager,
    SessionPhase,
    detectResumableSession,
    formatRelativeTime
} from '../engine/checkpoint';
import { OuroborosEngine } from '../engine/OuroborosEngine';

// ============================================================================
// USE RESUME SESSION HOOK
// ============================================================================
// Custom React hook for detecting and handling resumable sessions on app load.
// Provides state and handlers for the ResumeSessionDialog component.
//
// Reference: V2.99_Checkpoint_Resume_Implementation_Plan.md
// ============================================================================

export interface ResumableSessionInfo {
    sessionId: string;
    phase: SessionPhase;
    description: string;
    timestamp: number;
    progress: number;
    relativeTime: string;
}

export interface UseResumeSessionReturn {
    /** Whether a resumable session was detected */
    hasResumableSession: boolean;

    /** Whether the resume dialog should be shown */
    showDialog: boolean;

    /** Details about the resumable session */
    sessionInfo: ResumableSessionInfo | null;

    /** Whether resume is currently in progress */
    isResuming: boolean;

    /** Resume the session from its checkpoint */
    resumeSession: () => Promise<void>;

    /** Start a fresh session, discarding the resumable one */
    startFresh: () => Promise<void>;

    /** Close the dialog without taking action */
    dismissDialog: () => void;

    /** Manually check for resumable sessions */
    checkForResumableSession: () => Promise<void>;
}

/**
 * Custom hook for managing resume session functionality.
 * 
 * @param autoCheck - Whether to automatically check for resumable sessions on mount (default: true)
 * @returns Resume session state and handlers
 */
export function useResumeSession(autoCheck: boolean = true): UseResumeSessionReturn {
    const [hasResumableSession, setHasResumableSession] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [sessionInfo, setSessionInfo] = useState<ResumableSessionInfo | null>(null);
    const [isResuming, setIsResuming] = useState(false);

    /**
     * Check for resumable sessions
     */
    const checkForResumableSession = useCallback(async () => {
        try {
            const resumeData = await detectResumableSession();

            if (resumeData) {
                setSessionInfo({
                    sessionId: resumeData.sessionId,
                    phase: resumeData.phase,
                    description: resumeData.description,
                    timestamp: resumeData.timestamp,
                    progress: resumeData.progress,
                    relativeTime: formatRelativeTime(resumeData.timestamp)
                });
                setHasResumableSession(true);
                setShowDialog(true);
            } else {
                setHasResumableSession(false);
                setShowDialog(false);
                setSessionInfo(null);
            }
        } catch (error) {
            console.error('[useResumeSession] Error checking for resumable session:', error);
            setHasResumableSession(false);
        }
    }, []);

    /**
     * Resume the session from its checkpoint
     */
    const resumeSession = useCallback(async () => {
        if (!sessionInfo) return;

        setIsResuming(true);
        setShowDialog(false);

        try {
            const engine = OuroborosEngine.getInstance();
            const success = await engine.resumeFromCheckpoint(sessionInfo.sessionId);

            if (!success) {
                console.error('[useResumeSession] Resume failed');
                // Optionally re-show dialog or handle error
            }
        } catch (error) {
            console.error('[useResumeSession] Error resuming session:', error);
        } finally {
            setIsResuming(false);
        }
    }, [sessionInfo]);

    /**
     * Start a fresh session, clearing the resumable one
     */
    const startFresh = useCallback(async () => {
        setShowDialog(false);
        setHasResumableSession(false);
        setSessionInfo(null);

        try {
            const engine = OuroborosEngine.getInstance();
            await engine.clearSession();

            // Clear checkpoint data
            const checkpointManager = CheckpointManager.getInstance();
            await checkpointManager.clearCheckpoint();
        } catch (error) {
            console.error('[useResumeSession] Error clearing session:', error);
        }
    }, []);

    /**
     * Dismiss the dialog without taking action
     */
    const dismissDialog = useCallback(() => {
        setShowDialog(false);
    }, []);

    // Auto-check on mount if enabled
    useEffect(() => {
        if (autoCheck) {
            // Small delay to let the app initialize
            const timer = setTimeout(() => {
                checkForResumableSession();
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [autoCheck, checkForResumableSession]);

    return {
        hasResumableSession,
        showDialog,
        sessionInfo,
        isResuming,
        resumeSession,
        startFresh,
        dismissDialog,
        checkForResumableSession
    };
}

export default useResumeSession;

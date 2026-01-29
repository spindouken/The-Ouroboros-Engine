import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CheckpointManager, SessionPhase } from './checkpoint';
import { db } from '../db/ouroborosDB';

// Mock the DB module
vi.mock('../db/ouroborosDB', () => ({
    db: {
        projects: {
            update: vi.fn(),
            get: vi.fn()
        }
    }
}));

describe('CheckpointManager', () => {
    let manager: CheckpointManager;
    const sessionId = 'test-session-id';

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton instance if possible or just create new one
        // The class implementation uses a singleton but the constructor is public
        manager = new CheckpointManager(sessionId);
    });

    it('should save a checkpoint using queueMicrotask', async () => {
        const phase = SessionPhase.GENESIS_COMPLETE;
        const data = { genesisResult: { constitution: {} } };

        // We need to wait for queueMicrotask to process.
        // In a real env we can't easily await queueMicrotask, but we can verify it was queued 
        // or await a small delay.
        // Better yet: CheckpointManager usually has a sync method too, or we can just mock queueMicrotask.

        await new Promise<void>((resolve) => {
            const originalQueue = global.queueMicrotask;
            global.queueMicrotask = async (cb) => {
                await cb();
                resolve();
            };

            manager.checkpoint(phase, data);

            // Restore
            global.queueMicrotask = originalQueue;
        });

        expect(db.projects.update).toHaveBeenCalledWith(sessionId, expect.objectContaining({
            checkpoint: expect.objectContaining({
                phase: phase,
                totalSteps: 8,
                completedSteps: 2
            }),
            genesisResult: expect.any(Object),
            updatedAt: expect.any(Number)
        }));
    });

    it('should save a checkpoint synchronously', async () => {
        const phase = SessionPhase.AWAITING_REVIEW;
        const data = { verifiedBricks: [] };

        await manager.checkpointSync(phase, data);

        expect(db.projects.update).toHaveBeenCalledWith(sessionId, expect.objectContaining({
            checkpoint: expect.objectContaining({
                phase: phase
            }),
            verifiedBricks: []
        }));
    });

    it('should detect a resumable session', async () => {
        // Mock DB response
        vi.mocked(db.projects.get).mockResolvedValue({
            id: sessionId,
            checkpoint: {
                phase: SessionPhase.PRISM_STEP_B,
                timestamp: Date.now(),
                checkpointVersion: '1.0.0',
                totalSteps: 8,
                completedSteps: 3
            }
        });

        const result = await manager.canResume(sessionId);

        expect(result.resumable).toBe(true);
        expect(result.phase).toBe(SessionPhase.PRISM_STEP_B);
        expect(result.description).toContain('Tasks generated');
    });

    it('should return non-resumable for COMPLETE phase', async () => {
        vi.mocked(db.projects.get).mockResolvedValue({
            id: sessionId,
            checkpoint: {
                phase: SessionPhase.COMPLETE,
                timestamp: Date.now()
            }
        });

        const result = await manager.canResume(sessionId);

        expect(result.resumable).toBe(false);
    });

    it('should return non-resumable if no session found', async () => {
        vi.mocked(db.projects.get).mockResolvedValue(undefined);

        const result = await manager.canResume(sessionId);

        expect(result.resumable).toBe(false);
    });

    it('should clear checkpoint', async () => {
        await manager.clearCheckpoint();

        expect(db.projects.update).toHaveBeenCalledWith(sessionId, expect.objectContaining({
            checkpoint: undefined
        }));
    });
});

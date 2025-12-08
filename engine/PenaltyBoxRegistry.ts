import { PenaltyBoxEntry } from '../types';

export class PenaltyBoxRegistry {
    private registry: Map<string, number> = new Map(); // modelId -> expiryTimestamp

    /**
     * Places a model in the penalty box for a specified duration.
     * @param modelId The ID of the model to penalize
     * @param durationMs Duration in milliseconds (default: 5 minutes)
     */
    add(modelId: string, durationMs: number = 300000) { // Default 5 mins
        const expiry = Date.now() + durationMs;
        this.registry.set(modelId, expiry);
        console.warn(`[HYDRA] Model ${modelId} placed in Penalty Box until ${new Date(expiry).toLocaleTimeString()}`);
    }

    /**
     * Checks if a model is currently in the penalty box.
     * Automatically clears expired entries.
     */
    isRateLimited(modelId: string): boolean {
        const expiry = this.registry.get(modelId);
        if (!expiry) return false;

        if (Date.now() > expiry) {
            this.registry.delete(modelId);
            return false;
        }
        return true;
    }

    /**
     * Manually releases a model from the penalty box.
     */
    clear(modelId: string) {
        this.registry.delete(modelId);
        console.log(`[HYDRA] Model ${modelId} released from Penalty Box`);
    }

    /**
     * Returns the remaining penalty time in milliseconds.
     */
    getPenaltyTimeRemaining(modelId: string): number {
        const expiry = this.registry.get(modelId);
        if (!expiry) return 0;
        return Math.max(0, expiry - Date.now());
    }
}

/**
 * Rate Limiter for API calls
 * Tracks requests per minute (RPM) and requests per day (RPD)
 */

export interface RateLimitConfig {
    rpm: number; // Requests per minute
    rpd: number; // Requests per day
    enabled: boolean; // Whether rate limiting is enabled
}

export interface RateLimitStatus {
    currentMinuteCount: number;
    currentDayCount: number;
    minuteResetTime: number;
    dayResetTime: number;
    isLimited: boolean;
    waitTimeMs: number;
}

export class RateLimiter {
    private minuteCount: number = 0;
    private dayCount: number = 0;
    private minuteResetTime: number = 0;
    private dayResetTime: number = 0;
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
        this.resetCounters();
    }

    private resetCounters() {
        const now = Date.now();
        this.minuteResetTime = now + 60000; // 1 minute from now
        this.dayResetTime = now + 86400000; // 24 hours from now
    }

    /**
     * Update the rate limit configuration
     */
    updateConfig(config: Partial<RateLimitConfig>) {
        this.config = { ...this.config, ...config };
    }

    /**
     * Check if we can make a request
     */
    canMakeRequest(): boolean {
        if (!this.config.enabled) {
            return true;
        }

        const now = Date.now();

        // Reset minute counter if needed
        if (now >= this.minuteResetTime) {
            this.minuteCount = 0;
            this.minuteResetTime = now + 60000;
        }

        // Reset day counter if needed
        if (now >= this.dayResetTime) {
            this.dayCount = 0;
            this.dayResetTime = now + 86400000;
        }

        // Check limits
        if (this.minuteCount >= this.config.rpm) {
            return false;
        }

        if (this.dayCount >= this.config.rpd) {
            return false;
        }

        return true;
    }

    /**
     * Get the wait time in milliseconds before the next request can be made
     */
    getWaitTime(): number {
        if (!this.config.enabled) {
            return 0;
        }

        const now = Date.now();

        // If minute limit is hit, wait until minute resets
        if (this.minuteCount >= this.config.rpm) {
            return Math.max(0, this.minuteResetTime - now);
        }

        // If day limit is hit, wait until day resets
        if (this.dayCount >= this.config.rpd) {
            return Math.max(0, this.dayResetTime - now);
        }

        return 0;
    }

    /**
     * Record a request
     */
    recordRequest() {
        if (!this.config.enabled) {
            return;
        }

        const now = Date.now();

        // Reset counters if needed
        if (now >= this.minuteResetTime) {
            this.minuteCount = 0;
            this.minuteResetTime = now + 60000;
        }

        if (now >= this.dayResetTime) {
            this.dayCount = 0;
            this.dayResetTime = now + 86400000;
        }

        this.minuteCount++;
        this.dayCount++;
    }

    /**
     * Wait until a request can be made
     */
    async waitForSlot(): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        while (!this.canMakeRequest()) {
            const waitTime = this.getWaitTime();
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
            }
        }
    }

    /**
     * Get current status
     */
    getStatus(): RateLimitStatus {
        const now = Date.now();

        // Reset counters if needed
        if (now >= this.minuteResetTime) {
            this.minuteCount = 0;
            this.minuteResetTime = now + 60000;
        }

        if (now >= this.dayResetTime) {
            this.dayCount = 0;
            this.dayResetTime = now + 86400000;
        }

        return {
            currentMinuteCount: this.minuteCount,
            currentDayCount: this.dayCount,
            minuteResetTime: this.minuteResetTime,
            dayResetTime: this.dayResetTime,
            isLimited: !this.canMakeRequest(),
            waitTimeMs: this.getWaitTime()
        };
    }

    /**
     * Reset all counters
     */
    reset() {
        this.minuteCount = 0;
        this.dayCount = 0;
        this.resetCounters();
    }
}

/**
 * Create a rate limiter with default configuration
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
    return new RateLimiter(config);
}

// Client-side rate limiting for API calls
// Prevents abuse and excessive API usage

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.windowMs
    );

    if (this.requests.length >= this.config.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...this.requests);
    const timeUntilReset = this.config.windowMs - (Date.now() - oldestRequest);
    
    return Math.max(0, timeUntilReset);
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const recentRequests = this.requests.filter(
      timestamp => now - timestamp < this.config.windowMs
    );
    return Math.max(0, this.config.maxRequests - recentRequests.length);
  }
}

// Export rate limiters for different operations
export const interviewRateLimiter = new RateLimiter({
  maxRequests: 5, // Max 5 interviews per hour
  windowMs: 60 * 60 * 1000 // 1 hour
});

export const apiCallRateLimiter = new RateLimiter({
  maxRequests: 30, // Max 30 API calls per minute
  windowMs: 60 * 1000 // 1 minute
});

"use strict";

/**
 * Advanced rate limiting middleware with different strategies
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.keyGenerator = options.keyGenerator || ((req) => req.ip);
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    this.skipFailedRequests = options.skipFailedRequests || false;
    this.store = new Map();
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), this.windowMs);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now - data.resetTime > this.windowMs) {
        this.store.delete(key);
      }
    }
  }

  async isAllowed(request) {
    const key = this.keyGenerator(request);
    const now = Date.now();
    
    let data = this.store.get(key);
    
    if (!data || now - data.resetTime > this.windowMs) {
      data = {
        count: 0,
        resetTime: now,
        firstRequest: now
      };
      this.store.set(key, data);
    }

    data.count++;
    
    const remaining = Math.max(0, this.maxRequests - data.count);
    const resetTime = data.resetTime + this.windowMs;
    
    return {
      allowed: data.count <= this.maxRequests,
      limit: this.maxRequests,
      remaining,
      resetTime,
      retryAfter: resetTime - now
    };
  }
}

// Different rate limiters for different endpoints
const globalLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 1000,
  keyGenerator: (req) => req.ip
});

const authLimiter = new RateLimiter({
  windowMs: 900000, // 15 minutes
  maxRequests: 5,
  keyGenerator: (req) => req.ip
});

const userLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req) => req.auth?.userId || req.ip
});

const guildConfigLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 30,
  keyGenerator: (req) => `${req.auth?.userId || req.ip}:${req.params?.guildId || 'unknown'}`
});

/**
 * Rate limiting middleware factory
 */
function createRateLimit(limiter, options = {}) {
  return async function(request, reply) {
    try {
      const result = await limiter.isAllowed(request);
      
      // Add rate limit headers
      reply.header('X-RateLimit-Limit', result.limit);
      reply.header('X-RateLimit-Remaining', result.remaining);
      reply.header('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      if (!result.allowed) {
        reply.header('Retry-After', Math.ceil(result.retryAfter / 1000));
        
        request.log.warn({
          ip: request.ip,
          userId: request.auth?.userId,
          guildId: request.params?.guildId,
          limit: result.limit,
          retryAfter: result.retryAfter
        }, 'rate_limit_exceeded');
        
        return reply.code(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            status: 429,
            retryAfter: Math.ceil(result.retryAfter / 1000)
          }
        });
      }
      
      // Log if approaching limit
      if (result.remaining <= 5) {
        request.log.warn({
          ip: request.ip,
          userId: request.auth?.userId,
          remaining: result.remaining
        }, 'approaching_rate_limit');
      }
      
    } catch (error) {
      request.log.error({ err: error }, 'rate_limit_error');
      // Allow request to continue on rate limiter error
    }
  };
}

// Middleware functions
const globalRateLimit = createRateLimit(globalLimiter);
const authRateLimit = createRateLimit(authLimiter);
const userRateLimit = createRateLimit(userLimiter);
const guildConfigRateLimit = createRateLimit(guildConfigLimiter);

/**
 * Fastify plugin for rate limiting
 */
async function rateLimitingPlugin(fastify, options) {
  // Register global rate limiting hook
  fastify.addHook('onRequest', globalRateLimit);
  
  // Decorate with rate limiting utilities
  fastify.decorate('rateLimiters', {
    global: globalLimiter,
    auth: authLimiter,
    user: userLimiter,
    guildConfig: guildConfigLimiter
  });
  
  fastify.decorate('createRateLimit', createRateLimit);
}

module.exports = rateLimitingPlugin;

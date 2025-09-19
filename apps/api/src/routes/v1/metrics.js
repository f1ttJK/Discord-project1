"use strict";

const { cache } = require("../../utils/cache");
const { discordApiBreaker, databaseBreaker } = require("../../utils/circuitBreaker");

/**
 * Enhanced metrics endpoint for comprehensive monitoring
 * @param {import('fastify').FastifyInstance} fastify
 */
async function metricsRoutes(fastify) {
  fastify.get("/metrics", async (request, reply) => {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    
    // Basic system metrics
    const systemMetrics = {
      timestamp,
      uptime: Math.floor(uptime),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      pid: process.pid
    };

    // Application metrics
    const appMetrics = {
      requests: {
        total: fastify.metrics?.requestsTotal || 0
      },
      cache: cache.getStats(),
      circuitBreakers: {
        discord: discordApiBreaker.getStats(),
        database: databaseBreaker.getStats()
      }
    };

    // If Prometheus client is available, return Prometheus format
    if (fastify.prom?.register) {
      // Add custom metrics to Prometheus
      const prometheusMetrics = await fastify.prom.register.metrics();
      
      // Add cache metrics
      const cacheStats = cache.getStats();
      const customMetrics = `
# HELP api_cache_hits_total Total number of cache hits
# TYPE api_cache_hits_total counter
api_cache_hits_total ${cacheStats.hits}

# HELP api_cache_misses_total Total number of cache misses
# TYPE api_cache_misses_total counter
api_cache_misses_total ${cacheStats.misses}

# HELP api_cache_hit_rate Cache hit rate percentage
# TYPE api_cache_hit_rate gauge
api_cache_hit_rate ${cacheStats.hitRate}

# HELP api_cache_size Current cache size
# TYPE api_cache_size gauge
api_cache_size ${cacheStats.size}

# HELP api_circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)
# TYPE api_circuit_breaker_state gauge
api_circuit_breaker_state{service="discord"} ${cacheStats.discord?.state === 'CLOSED' ? 0 : cacheStats.discord?.state === 'HALF_OPEN' ? 1 : 2}
api_circuit_breaker_state{service="database"} ${cacheStats.database?.state === 'CLOSED' ? 0 : cacheStats.database?.state === 'HALF_OPEN' ? 1 : 2}

# HELP api_circuit_breaker_failures_total Total circuit breaker failures
# TYPE api_circuit_breaker_failures_total counter
api_circuit_breaker_failures_total{service="discord"} ${appMetrics.circuitBreakers.discord.failureCount}
api_circuit_breaker_failures_total{service="database"} ${appMetrics.circuitBreakers.database.failureCount}
`;

      reply.type('text/plain');
      return prometheusMetrics + customMetrics;
    }

    // Return JSON format for non-Prometheus consumers
    return {
      ...systemMetrics,
      application: appMetrics
    };
  });

  // Detailed cache metrics endpoint
  fastify.get("/metrics/cache", async (request, reply) => {
    const stats = cache.getStats();
    const keys = cache.getKeys();
    
    return {
      stats,
      keys: keys.slice(0, 100), // Limit to first 100 keys
      totalKeys: keys.length
    };
  });

  // Circuit breaker status endpoint
  fastify.get("/metrics/circuit-breakers", async (request, reply) => {
    return {
      discord: discordApiBreaker.getStats(),
      database: databaseBreaker.getStats()
    };
  });
}

module.exports = metricsRoutes;

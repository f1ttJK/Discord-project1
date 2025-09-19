"use strict";

const { discordApiBreaker, databaseBreaker } = require("../../utils/circuitBreaker");

/**
 * Enhanced health check endpoint with dependency status
 * @param {import('fastify').FastifyInstance} fastify
 */
async function healthRoutes(fastify) {
  fastify.get("/health", async (request, reply) => {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    
    // Check circuit breaker states
    const discordStatus = discordApiBreaker.getStats();
    const dbStatus = databaseBreaker.getStats();
    
    // Determine overall health
    const isHealthy = discordStatus.state !== 'OPEN' && dbStatus.state !== 'OPEN';
    const status = isHealthy ? 'healthy' : 'degraded';
    
    const healthData = {
      status,
      timestamp,
      uptime: Math.floor(uptime),
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        discord: {
          status: discordStatus.state.toLowerCase(),
          failures: discordStatus.failureCount,
          successes: discordStatus.successCount
        },
        database: {
          status: dbStatus.state.toLowerCase(),
          failures: dbStatus.failureCount,
          successes: dbStatus.successCount
        }
      },
      metrics: {
        totalRequests: fastify.metrics?.requestsTotal || 0,
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    };
    
    // Return appropriate status code
    const statusCode = isHealthy ? 200 : 503;
    return reply.code(statusCode).send(healthData);
  });

  // Readiness probe (for Kubernetes)
  fastify.get("/ready", async (request, reply) => {
    const isReady = discordApiBreaker.getStats().state !== 'OPEN' && 
                   databaseBreaker.getStats().state !== 'OPEN';
    
    if (isReady) {
      return { ready: true, timestamp: new Date().toISOString() };
    } else {
      return reply.code(503).send({ 
        ready: false, 
        timestamp: new Date().toISOString(),
        reason: 'Dependencies unavailable'
      });
    }
  });

  // Liveness probe (for Kubernetes)
  fastify.get("/live", async (request, reply) => {
    return { alive: true, timestamp: new Date().toISOString() };
  });
}

module.exports = healthRoutes;

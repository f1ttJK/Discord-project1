"use strict";

/**
 * Enhanced logging middleware with structured context
 */
function enhancedLogging() {
  return async function(request, reply) {
    // Add structured context to request logger
    const baseContext = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: request.auth?.userId,
      guildId: request.params?.guildId,
      timestamp: new Date().toISOString()
    };

    // Enhance request logger with context
    request.log = request.log.child(baseContext);

    // Log request start
    request.log.info({
      operation: 'request_start',
      headers: {
        'content-type': request.headers['content-type'],
        'authorization': request.headers.authorization ? '[REDACTED]' : undefined
      }
    }, 'incoming_request');

    // Track response
    reply.addHook('onSend', async (request, reply, payload) => {
      const responseTime = Date.now() - request.startTime;
      
      request.log.info({
        operation: 'request_complete',
        statusCode: reply.statusCode,
        responseTime,
        contentLength: payload ? payload.length : 0
      }, 'request_completed');

      return payload;
    });

    // Track errors
    reply.addHook('onError', async (request, reply, error) => {
      request.log.error({
        operation: 'request_error',
        err: error,
        statusCode: reply.statusCode || 500
      }, 'request_failed');
    });
  };
}

/**
 * Audit logging for sensitive operations
 */
function auditLog(operation) {
  return async function(request, reply) {
    const context = {
      operation,
      userId: request.auth?.userId,
      guildId: request.params?.guildId,
      timestamp: new Date().toISOString(),
      ip: request.ip,
      userAgent: request.headers['user-agent']
    };

    // Log before operation
    request.log.info(context, `audit_${operation}_start`);

    // Log after operation
    reply.addHook('onSend', async (request, reply, payload) => {
      request.log.info({
        ...context,
        statusCode: reply.statusCode,
        success: reply.statusCode < 400
      }, `audit_${operation}_complete`);

      return payload;
    });
  };
}

/**
 * Performance monitoring middleware
 */
function performanceMonitoring() {
  return async function(request, reply) {
    const startTime = process.hrtime.bigint();
    request.startTime = Date.now();

    reply.addHook('onSend', async (request, reply, payload) => {
      const endTime = process.hrtime.bigint();
      const durationNs = endTime - startTime;
      const durationMs = Number(durationNs) / 1e6;

      // Log slow requests (>500ms)
      if (durationMs > 500) {
        request.log.warn({
          operation: 'slow_request',
          durationMs,
          route: request.routerPath,
          method: request.method
        }, 'slow_request_detected');
      }

      // Add performance headers
      reply.header('X-Response-Time', `${durationMs.toFixed(2)}ms`);
      reply.header('X-Request-ID', request.id);

      return payload;
    });
  };
}

/**
 * Fastify plugin for enhanced logging
 */
async function loggingPlugin(fastify, options) {
  // Add enhanced logging hook
  fastify.addHook('onRequest', async (request, reply) => {
    const baseContext = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: request.auth?.userId,
      guildId: request.params?.guildId,
      timestamp: new Date().toISOString()
    };

    request.log = request.log.child(baseContext);
    request.startTime = Date.now();

    request.log.info({
      operation: 'request_start',
      headers: {
        'content-type': request.headers['content-type'],
        'authorization': request.headers.authorization ? '[REDACTED]' : undefined
      }
    }, 'incoming_request');
  });

  // Add response logging hook
  fastify.addHook('onSend', async (request, reply, payload) => {
    const responseTime = Date.now() - request.startTime;
    
    request.log.info({
      operation: 'request_complete',
      statusCode: reply.statusCode,
      responseTime,
      contentLength: payload ? payload.length : 0
    }, 'request_completed');

    // Add performance headers
    reply.header('X-Response-Time', `${responseTime}ms`);
    reply.header('X-Request-ID', request.id);

    // Log slow requests (>500ms)
    if (responseTime > 500) {
      request.log.warn({
        operation: 'slow_request',
        responseTime,
        route: request.routerPath,
        method: request.method
      }, 'slow_request_detected');
    }

    return payload;
  });

  // Add error logging hook
  fastify.addHook('onError', async (request, reply, error) => {
    request.log.error({
      operation: 'request_error',
      err: error,
      statusCode: reply.statusCode || 500
    }, 'request_failed');
  });

  // Decorate with audit logging function
  fastify.decorate('auditLog', function(operation, context = {}) {
    this.log.info({
      operation: `audit_${operation}`,
      ...context,
      timestamp: new Date().toISOString()
    }, `audit_${operation}`);
  });
}

module.exports = loggingPlugin;

"use strict";

const crypto = require('crypto');

/**
 * Security middleware for enhanced protection
 */

/**
 * CSRF protection for cookie-based sessions
 */
function csrfProtection() {
  return async function(request, reply) {
    // Skip CSRF for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return;
    }

    // Skip for API token auth (JWT)
    if (request.headers.authorization?.startsWith('Bearer ')) {
      return;
    }

    const token = request.headers['x-csrf-token'] || request.body?.csrfToken;
    const sessionToken = request.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      request.log.warn({
        ip: request.ip,
        userId: request.auth?.userId,
        hasToken: !!token,
        hasSessionToken: !!sessionToken
      }, 'csrf_token_mismatch');

      return reply.code(403).send({
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'CSRF token missing or invalid',
          status: 403
        }
      });
    }
  };
}

/**
 * Request size limiting
 */
function requestSizeLimit(maxSize = 1024 * 1024) { // 1MB default
  return async function(request, reply) {
    const contentLength = parseInt(request.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      request.log.warn({
        ip: request.ip,
        contentLength,
        maxSize
      }, 'request_too_large');

      return reply.code(413).send({
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'Request body too large',
          status: 413,
          maxSize
        }
      });
    }
  };
}

/**
 * IP whitelist/blacklist
 */
function ipFilter(options = {}) {
  const { whitelist = [], blacklist = [] } = options;
  
  return async function(request, reply) {
    const ip = request.ip;
    const forwardedIp = request.headers['x-forwarded-for']?.split(',')[0]?.trim();
    const realIp = forwardedIp || ip;

    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(realIp)) {
      request.log.warn({ ip: realIp }, 'ip_blacklisted');
      return reply.code(403).send({
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied',
          status: 403
        }
      });
    }

    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(realIp)) {
      request.log.warn({ ip: realIp }, 'ip_not_whitelisted');
      return reply.code(403).send({
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied',
          status: 403
        }
      });
    }
  };
}

/**
 * Request signature validation for webhooks
 */
function validateSignature(secret, headerName = 'x-signature-256') {
  return async function(request, reply) {
    const signature = request.headers[headerName];
    const body = request.body;

    if (!signature) {
      return reply.code(401).send({
        error: {
          code: 'SIGNATURE_MISSING',
          message: 'Request signature required',
          status: 401
        }
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      request.log.warn({
        ip: request.ip,
        providedSignature: providedSignature.substring(0, 8) + '...'
      }, 'invalid_signature');

      return reply.code(401).send({
        error: {
          code: 'SIGNATURE_INVALID',
          message: 'Invalid request signature',
          status: 401
        }
      });
    }
  };
}

/**
 * User agent validation
 */
function validateUserAgent(options = {}) {
  const { required = true, blocked = [] } = options;
  
  return async function(request, reply) {
    const userAgent = request.headers['user-agent'];

    if (required && !userAgent) {
      return reply.code(400).send({
        error: {
          code: 'USER_AGENT_REQUIRED',
          message: 'User-Agent header required',
          status: 400
        }
      });
    }

    if (userAgent && blocked.some(pattern => 
      typeof pattern === 'string' ? userAgent.includes(pattern) : pattern.test(userAgent)
    )) {
      request.log.warn({ userAgent, ip: request.ip }, 'blocked_user_agent');
      return reply.code(403).send({
        error: {
          code: 'USER_AGENT_BLOCKED',
          message: 'Access denied',
          status: 403
        }
      });
    }
  };
}

/**
 * Request timeout middleware
 */
function requestTimeout(timeoutMs = 30000) {
  return async function(request, reply) {
    const timeout = setTimeout(() => {
      if (!reply.sent) {
        request.log.warn({
          route: request.routerPath,
          method: request.method,
          timeout: timeoutMs
        }, 'request_timeout');

        reply.code(408).send({
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout',
            status: 408
          }
        });
      }
    }, timeoutMs);

    reply.addHook('onSend', async () => {
      clearTimeout(timeout);
    });
  };
}

/**
 * Fastify plugin for security middleware
 */
async function securityPlugin(fastify, options) {
  // Add basic security hooks
  fastify.addHook('onRequest', requestSizeLimit(1024 * 1024)); // 1MB limit
  fastify.addHook('onRequest', validateUserAgent({ required: false }));
  fastify.addHook('onRequest', requestTimeout(30000)); // 30s timeout
  
  // Decorate with security utilities
  fastify.decorate('security', {
    csrfProtection,
    requestSizeLimit,
    ipFilter,
    validateSignature,
    validateUserAgent,
    requestTimeout
  });
}

module.exports = securityPlugin;

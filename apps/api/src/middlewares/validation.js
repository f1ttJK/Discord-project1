"use strict";

const { ZodError } = require("zod");

/**
 * Middleware для валидации запросов с помощью Zod схем
 */
function validateRequest(schemas = {}) {
  return async function(request, reply) {
    try {
      // Валидация параметров URL
      if (schemas.params) {
        const result = schemas.params.safeParse(request.params);
        if (!result.success) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_PARAMS',
              message: 'Invalid URL parameters',
              status: 400,
              details: result.error.flatten()
            }
          });
        }
        request.params = result.data;
      }

      // Валидация query параметров
      if (schemas.query) {
        const result = schemas.query.safeParse(request.query);
        if (!result.success) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_QUERY',
              message: 'Invalid query parameters',
              status: 400,
              details: result.error.flatten()
            }
          });
        }
        request.query = result.data;
      }

      // Валидация тела запроса
      if (schemas.body) {
        const result = schemas.body.safeParse(request.body);
        if (!result.success) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_BODY',
              message: 'Invalid request body',
              status: 400,
              details: result.error.flatten()
            }
          });
        }
        request.body = result.data;
      }

      // Валидация заголовков
      if (schemas.headers) {
        const result = schemas.headers.safeParse(request.headers);
        if (!result.success) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_HEADERS',
              message: 'Invalid request headers',
              status: 400,
              details: result.error.flatten()
            }
          });
        }
        request.headers = { ...request.headers, ...result.data };
      }

    } catch (error) {
      request.log.error({ err: error, route: request.routerPath }, 'validation_middleware_error');
      return reply.code(500).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Internal validation error',
          status: 500
        }
      });
    }
  };
}

/**
 * Middleware для обработки ошибок валидации
 */
function validationErrorHandler(error, request, reply) {
  if (error instanceof ZodError) {
    const status = 400;
    request.log.warn({ 
      err: error, 
      route: request.routerPath, 
      issues: error.issues,
      userId: request.auth?.userId,
      guildId: request.params?.guildId
    }, "zod_validation_error");
    
    return reply.code(status).send({ 
      error: { 
        code: 'VALIDATION_ERROR', 
        status, 
        message: 'Request validation failed',
        issues: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }))
      } 
    });
  }
  
  // Передаем другие ошибки дальше
  throw error;
}

/**
 * Fastify plugin for request validation
 */
async function validationPlugin(fastify, options) {
  // Add global error handler for Zod validation errors
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const status = 400;
      request.log.warn({ 
        err: error, 
        route: request.routerPath, 
        issues: error.issues,
        userId: request.auth?.userId,
        guildId: request.params?.guildId
      }, "zod_validation_error");
      
      return reply.code(status).send({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          status, 
          message: 'Request validation failed',
          issues: error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          }))
        } 
      });
    }
    
    // Let other errors pass through
    throw error;
  });

  // Decorate with validation helper
  fastify.decorate('validateRequest', validateRequest);
}

module.exports = validationPlugin;

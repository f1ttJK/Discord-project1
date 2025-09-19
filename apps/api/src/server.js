"use strict";

require('dotenv').config();
const Fastify = require("fastify");
const cors = require("@fastify/cors");
const cookie = require("@fastify/cookie");
const { loadEnv } = require("./utils/env");
const { loadSession } = require("./middlewares/auth");
const validationMiddleware = require("./middlewares/validation");
const loggingMiddleware = require("./middlewares/logging");
const rateLimitingMiddleware = require("./middlewares/rateLimiting");
const securityMiddleware = require("./middlewares/security");
let helmetPlugin = null;
let rateLimitPlugin = null;
let promClient = null;
try { helmetPlugin = require("@fastify/helmet"); } catch {}
try { rateLimitPlugin = require("@fastify/rate-limit"); } catch {}
try { promClient = require("prom-client"); } catch {}
let ZodError = null; try { ({ ZodError } = require("zod")); } catch {}

async function buildServer() {
  const env = loadEnv();
  const app = Fastify({
    logger: {
      level: env.logLevel,
      transport: env.nodeEnv !== "production" ? { target: "pino-pretty" } : undefined,
    },
    disableRequestLogging: env.nodeEnv === "production",
  });

  // Make env config available to plugins
  app.decorate("config", env);
  // Basic metrics container
  app.decorate("metrics", { requestsTotal: 0 });
  // Prometheus metrics (if prom-client available)
  if (promClient) {
    const register = new promClient.Registry();
    promClient.collectDefaultMetrics({ register });
    const httpRequestsTotal = new promClient.Counter({
      name: 'api_requests_total',
      help: 'Total number of API requests',
      registers: [register],
    });
    const httpRequestDurationMs = new promClient.Histogram({
      name: 'api_request_duration_ms',
      help: 'Duration of API requests in ms',
      buckets: [5, 10, 20, 50, 100, 200, 500, 1000, 2000],
      registers: [register],
    });
    app.decorate('prom', { register, httpRequestsTotal, httpRequestDurationMs });
  }

  // CORS (match origin ignoring trailing slash, allow localhost:5173/5174 in dev)
  const normalizeOrigin = (o) => (typeof o === 'string' ? o.replace(/\/$/, '') : o);
  const configuredOrigin = normalizeOrigin(env.corsOrigin);
  await app.register(cors, {
    origin: (origin, cb) => {
      try {
        if (!origin) return cb(null, true); // same-origin or curl
        const o = normalizeOrigin(origin);
        const ok = (
          o === configuredOrigin ||
          (env.nodeEnv !== 'production' && (o === 'http://localhost:5173' || o === 'http://localhost:5174'))
        );
        cb(null, ok);
      } catch (e) { cb(e, false); }
    },
    credentials: true,
  });

  // Cookies (for session cookie)
  await app.register(cookie, {
    secret: env.session.cookieSecret || "dev-secret", // consider required in production
    hook: "onRequest",
  });

  // Register middlewares
  await app.register(loggingMiddleware);
  await app.register(validationMiddleware);
  await app.register(rateLimitingMiddleware);
  await app.register(securityMiddleware);

  // Load session for every request (non-blocking)
  app.addHook("preHandler", loadSession);

  // Increment request counter
  app.addHook("onRequest", async (req, _reply) => {
    try { app.metrics.requestsTotal += 1; } catch {}
    try { app.prom?.httpRequestsTotal?.inc(); } catch {}
    // mark start time for histogram
    req._startTime = process.hrtime.bigint ? process.hrtime.bigint() : process.hrtime();
  });

  // Observe duration
  app.addHook('onResponse', async (req, reply) => {
    try {
      const start = req._startTime;
      if (!start) return;
      let durationMs = 0;
      if (typeof start === 'bigint' && process.hrtime.bigint) {
        const end = process.hrtime.bigint();
        durationMs = Number(end - start) / 1e6;
      } else if (Array.isArray(start)) {
        const diff = process.hrtime(start);
        durationMs = (diff[0] * 1e3) + (diff[1] / 1e6);
      }
      app.prom?.httpRequestDurationMs?.observe(durationMs);
    } catch {}
  });

  // Helmet (security headers) if available
  if (helmetPlugin) {
    await app.register(helmetPlugin, { contentSecurityPolicy: false });
  }
  // Basic rate limit if available (fallback only)
  if (rateLimitPlugin && !rateLimitingMiddleware) {
    await app.register(rateLimitPlugin, { max: 100, timeWindow: '1 minute', allowList: [], ban: 0 });
  }

  // Health route under /v1
  await app.register(require("./routes/v1/health"), { prefix: "/v1" });
  // Metrics route under /v1
  await app.register(require("./routes/v1/metrics"), { prefix: "/v1" });
  // Auth routes under /v1
  await app.register(require("./routes/v1/auth"), { prefix: "/v1" });
  // Me route under /v1 (requires session)
  await app.register(require("./routes/v1/me"), { prefix: "/v1" });
  // Guilds route under /v1 (requires session)
  await app.register(require("./routes/v1/guilds"), { prefix: "/v1" });
  // Member stats routes under /v1 (requires auth)
  await app.register(require("./routes/v1/member-stats"), { prefix: "/v1" });
  // Leveling accrual routes under /v1 (requires auth)
  await app.register(require("./routes/v1/leveling"), { prefix: "/v1" });
  // Economy routes under /v1 (requires auth)
  await app.register(require("./routes/v1/economy"), { prefix: "/v1" });
  // Enhanced guild config routes under /v1 (requires session)
  await app.register(require("./routes/v1/enhanced-guild-config"), { prefix: "/v1" });
  // API documentation routes under /v1
  await app.register(require("./routes/v1/documentation"), { prefix: "/v1" });
  // System settings routes under /v1 (leveling, warns)
  await app.register(require("./routes/v1/settings"), { prefix: "/v1" });
  // Warns escalation routes under /v1
  await app.register(require("./routes/v1/warns-escalation"), { prefix: "/v1" });
  // Warns CRUD routes under /v1
  await app.register(require("./routes/v1/warns"), { prefix: "/v1" });
  // Warn reasons routes under /v1
  await app.register(require("./routes/v1/warn-reasons"), { prefix: "/v1" });

  // Root redirect to dashboard (helps after OAuth callback testing)
  app.get('/', async (req, reply) => {
    const url = app.config.dashboardUrl || '/v1/health';
    reply.redirect(url);
  });

  // Centralized error handler
  app.setErrorHandler((error, request, reply) => {
    // Zod validation error -> 400 with issues
    if (ZodError && error instanceof ZodError) {
      const status = 400;
      request.log.warn({ err: error, route: request.routerPath, issues: error.issues }, "validation_error");
      return reply.code(status).send({ error: { code: 'INVALID_PAYLOAD', status, issues: error.issues } });
    }
    // Fastify validationError shape
    if (error?.validation) {
      const status = 400;
      request.log.warn({ err: error, route: request.routerPath, validation: error.validation }, "validation_error");
      return reply.code(status).send({ error: { code: 'INVALID_PAYLOAD', status, issues: error.validation } });
    }
    request.log.error({ err: error, route: request.routerPath }, "unhandled_error");
    const status = error.statusCode || 500;
    return reply.code(status).send({
      error: {
        message: env.nodeEnv === "production" && status === 500 ? "Internal Server Error" : error.message,
        code: error.code || "UNEXPECTED_ERROR",
        status,
      },
    });
  });

  // Unified 404
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', status: 404, message: 'Route not found' } });
  });

  // Graceful shutdown hooks
  app.addHook("onClose", async () => {
    app.log.info("Server closing...");
  });

  return { app, env };
}

async function start() {
  const { app, env } = await buildServer();
  try {
    await app.listen({ port: env.port, host: "0.0.0.0" });
    app.log.info({ port: env.port }, "API listening");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { buildServer };

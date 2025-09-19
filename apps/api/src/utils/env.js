"use strict";

const { z } = require("zod");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().optional(),
  DASHBOARD_URL: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("sid"),
  SESSION_TTL_HOURS: z.string().optional(),
  SESSION_COOKIE_SECRET: z.string().optional(),
  API_SERVICE_TOKEN: z.string().optional(),
  API_JWT_SECRET: z.string().optional(),
});

/**
 * Validate process.env and return typed config
 */
function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Flatten issues for readable output
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment variables: ${issues}`);
  }
  const env = parsed.data;

  // Enforce required fields in production
  const errors = [];
  if (env.NODE_ENV === 'production') {
    if (!env.SESSION_COOKIE_SECRET) errors.push('SESSION_COOKIE_SECRET is required in production');
    if (!env.DISCORD_CLIENT_ID) errors.push('DISCORD_CLIENT_ID is required in production');
    if (!env.DISCORD_CLIENT_SECRET) errors.push('DISCORD_CLIENT_SECRET is required in production');
    if (!env.DISCORD_REDIRECT_URI) errors.push('DISCORD_REDIRECT_URI is required in production');
    if (!env.API_JWT_SECRET) errors.push('API_JWT_SECRET is required in production');
  }
  if (errors.length) {
    throw new Error(`Invalid production environment: ${errors.join('; ')}`);
  }
  return {
    nodeEnv: env.NODE_ENV,
    port: Number(env.PORT ?? 4000),
    corsOrigin: env.CORS_ORIGIN ?? "*",
    logLevel: env.LOG_LEVEL,
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      redirectUri: env.DISCORD_REDIRECT_URI,
    },
    dashboardUrl: env.DASHBOARD_URL,
    session: {
      cookieName: env.SESSION_COOKIE_NAME,
      ttlHours: Number(env.SESSION_TTL_HOURS ?? 24),
      cookieSecret: env.SESSION_COOKIE_SECRET,
    },
    apiServiceToken: env.API_SERVICE_TOKEN,
    jwt: {
      secret: env.API_JWT_SECRET,
    },
  };
}

module.exports = { loadEnv };

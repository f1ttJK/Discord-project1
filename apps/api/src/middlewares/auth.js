"use strict";

const { getPrisma } = require("../repos/prisma");
const { verify: verifyJwt } = require("../utils/jwt");

/**
 * Resolve session from cookie and decorate request with auth info if valid.
 * Also supports service-to-service bearer token via Authorization header.
 * Does not enforce authentication by itself.
 * Usage: app.addHook('preHandler', loadSession)
 */
async function loadSession(request, reply) {
  const app = request.server;
  // Service-to-service bearer token takes precedence
  const authz = request.headers["authorization"] || request.headers["Authorization"];
  if (authz && typeof authz === "string" && authz.startsWith("Bearer ")) {
    const token = authz.slice("Bearer ".length).trim();
    if (token && app.config.apiServiceToken && token === app.config.apiServiceToken) {
      request.auth = { service: true };
      return; // short-circuit, no need to load cookie session
    }
    // Try JWT verify if secret exists
    if (token && app.config?.jwt?.secret) {
      const payload = verifyJwt(token, app.config.jwt.secret);
      if (payload && payload.sub) {
        request.auth = { userId: String(payload.sub), jwt: true };
        return;
      }
    }
  }

  const cookieName = app.config.session.cookieName;
  let sid = request.cookies?.[cookieName];
  if (!sid) return;
  // If cookies are signed, verify and extract value
  if (app.config.session.cookieSecret && typeof request.unsignCookie === 'function') {
    const res = request.unsignCookie(sid);
    if (!res.valid) return; // tampered or invalid signature
    sid = res.value;
  }
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({ where: { id: sid } });
  if (!session) return;
  if (session.expiresAt <= new Date()) return; // expired
  request.auth = { userId: session.userId, sessionId: session.id };
}

/**
 * Enforce that a valid session exists, otherwise 401.
 */
async function requireAuth(request, reply) {
  if (request.auth?.service) {
    return; // machine client authorized
  }
  if (!request.auth?.userId) {
    reply.code(401).send({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } });
    return reply; // stop chain
  }
}

/**
 * Enforce that a valid JWT (or service token) exists, otherwise 401.
 */
async function requireJwt(request, reply) {
  if (request.auth?.service) return;
  if (!request.auth?.jwt || !request.auth?.userId) {
    reply.code(401).send({ error: { message: "Unauthorized (JWT required)", code: "UNAUTHORIZED" } });
    return reply;
  }
}

module.exports = { loadSession, requireAuth, requireJwt };

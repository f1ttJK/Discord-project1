"use strict";

/**
 * Auth routes (OAuth2 skeleton)
 * @param {import('fastify').FastifyInstance} fastify
 */
async function authRoutes(fastify) {
  // Redirect user to Discord OAuth2 authorize URL
  fastify.get("/auth/login", async (request, reply) => {
    const clientId = fastify.config.discord.clientId;
    const redirectUri = fastify.config.discord.redirectUri;
    if (!clientId || !redirectUri) {
      reply.code(501).send({ error: { message: "OAuth2 is not configured yet", code: "OAUTH_NOT_CONFIGURED" } });
      return;
    }
    const scope = encodeURIComponent("identify guilds");
    const responseType = "code";
    const prompt = "none";
    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}&prompt=${prompt}`;
    reply.redirect(url);
  });

  // Handle OAuth2 callback (skeleton)
  fastify.get("/auth/callback", async (request, reply) => {
    const { code } = request.query;
    const { clientId, clientSecret, redirectUri } = fastify.config.discord;
    if (!code || !clientId || !clientSecret || !redirectUri) {
      reply.code(400).send({ error: { message: "Missing code or OAuth2 config", code: "OAUTH_BAD_REQUEST" } });
      return;
    }
    try {
      const { request: undiciRequest } = require("undici");
      // Exchange code for tokens (with minimal retry on rate limiting)
      let tokenJson = null;
      let lastErrBody = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const tokenRes = await undiciRequest("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }).toString(),
        });
        if (tokenRes.statusCode < 400) {
          tokenJson = await tokenRes.body.json();
          break;
        }
        const body = await tokenRes.body.text();
        lastErrBody = body;
        // Discord may respond 400 with rate limit message; retry once with backoff
        const isRateLimited = tokenRes.statusCode === 429 || String(body).toLowerCase().includes("rate limited");
        fastify.log.warn({ status: tokenRes.statusCode, body, attempt }, "oauth_token_exchange_failed");
        if (attempt < 2 && isRateLimited) {
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }
        reply.code(401).send({ error: { message: "OAuth2 token exchange failed", code: "OAUTH_EXCHANGE_FAILED" } });
        return;
      }
      const accessToken = tokenJson.access_token;
      const refreshToken = tokenJson.refresh_token;
      const tokenType = tokenJson.token_type;
      const scope = tokenJson.scope;
      const expiresAt = tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : null;

      // Fetch profile
      const meRes = await undiciRequest("https://discord.com/api/users/@me", {
        method: "GET",
        headers: { Authorization: `${tokenType} ${accessToken}` },
      });
      if (meRes.statusCode >= 400) {
        const body = await meRes.body.text();
        fastify.log.warn({ status: meRes.statusCode, body }, "oauth_profile_fetch_failed");
        reply.code(401).send({ error: { message: "Failed to fetch Discord profile", code: "OAUTH_PROFILE_FAILED" } });
        return;
      }
      const profile = await meRes.body.json();

      // Persist tokens
      const { upsertDiscordAccount } = require("../../repos/oauth");
      await upsertDiscordAccount({
        profile,
        tokens: { accessToken, refreshToken, tokenType, scope, expiresAt },
      });

      // Create session and set cookie
      const { createSession } = require("../../repos/session");
      const session = await createSession(profile.id, fastify.config.session.ttlHours);

      const isProd = fastify.config.nodeEnv === "production";
      reply.setCookie(fastify.config.session.cookieName, session.id, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "lax" : "lax",
        path: "/",
        expires: session.expiresAt,
        signed: Boolean(fastify.config.session.cookieSecret),
      });

      // Redirect to dashboard
      const redirectTo = fastify.config.dashboardUrl || "/";
      reply.redirect(redirectTo);
    } catch (err) {
      request.log.error({ err }, "oauth_callback_error");
      reply.code(500).send({ error: { message: "OAuth2 callback error", code: "OAUTH_CALLBACK_ERROR" } });
    }
  });

  // Logout (skeleton)
  fastify.post("/auth/logout", async (request, reply) => {
    try {
      const { deleteSession } = require("../../repos/session");
      const sid = request.cookies?.[fastify.config.session.cookieName];
      if (sid) await deleteSession(sid);
      reply.clearCookie(fastify.config.session.cookieName, { path: "/" });
      return { ok: true };
    } catch (err) {
      request.log.error({ err }, "logout_error");
      reply.code(500).send({ error: { message: "Logout failed", code: "LOGOUT_ERROR" } });
    }
  });
}

module.exports = authRoutes;

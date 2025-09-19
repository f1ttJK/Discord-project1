"use strict";

const { requireAuth } = require("../../middlewares/auth");
const { getDiscordAccessToken, refreshDiscordToken } = require("../../repos/oauth");
const { discordRequest, canManageGuild } = require("../../utils/discord");
const { cache } = require("../../utils/cache");
const { requestQueue } = require("../../utils/requestQueue");

/**
 * /v1/guilds route: returns user's manageable guilds (via Discord OAuth token)
 * @param {import('fastify').FastifyInstance} fastify
 */
async function guildsRoutes(fastify) {
  fastify.get("/guilds", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.auth.userId;
    const cacheKey = `guilds:${userId}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return { guilds: cached };
    }

    // Use request queue to prevent duplicate concurrent requests
    return requestQueue.execute(cacheKey, async () => {
      // Double-check cache in case another request populated it
      const cached = cache.get(cacheKey);
      if (cached) {
        return { guilds: cached };
      }

      let accessToken = await getDiscordAccessToken(userId);
      if (!accessToken) {
        reply.code(401).send({ error: { message: "No Discord access token", code: "NO_DISCORD_TOKEN" } });
        return;
      }

      let { status, data, headers } = await discordRequest("/users/@me/guilds", { accessToken });
    if (status >= 400) {
      // Try refresh on auth-related failures and retry once
      if (status === 401 || status === 403) {
        try {
          const newToken = await refreshDiscordToken({
            userId,
            clientId: fastify.config.discord.clientId,
            clientSecret: fastify.config.discord.clientSecret,
          });
          if (newToken) {
            accessToken = newToken;
            ({ status, data, headers } = await discordRequest("/users/@me/guilds", { accessToken }));
          }
        } catch (e) {
          request.log.warn({ err: e }, "discord_token_refresh_failed");
        }
      }
      // Handle rate limit: backoff once
      if (status === 429) {
        const ra = Number(headers?.["retry-after"]) || Number(headers?.["x-ratelimit-reset-after"]) || 1.2;
        const delayMs = Math.min(3000, Math.max(800, Math.round(ra * 1000)));
        await new Promise(r => setTimeout(r, delayMs));
        ({ status, data, headers } = await discordRequest("/users/@me/guilds", { accessToken }));
        if (status === 429) {
          // propagate meaningful rate limit info to client
          return reply.code(429).send({ error: { code: "DISCORD_RATE_LIMIT", message: "Discord rate limit, try again later", retryAfterMs: delayMs } });
        }
      }
      if (status >= 400) {
        request.log.warn({ status, userId }, "discord_guilds_fetch_failed");
        reply.code(502).send({ error: { message: "Failed to fetch guilds from Discord", code: "DISCORD_UPSTREAM_ERROR" } });
        return;
      }
    }

    const manageable = Array.isArray(data)
      ? data.filter(g => canManageGuild(g.permissions)).map(g => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          owner: g.owner,
          permissions: g.permissions,
          features: g.features,
        }))
      : [];

      // Cache the result for 60 seconds
      cache.set(cacheKey, manageable, 60000);

      return { guilds: manageable };
    });
  });
}

module.exports = guildsRoutes;

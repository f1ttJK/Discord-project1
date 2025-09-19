"use strict";

const { requireAuth } = require("../../middlewares/auth");
const { getDiscordAccessToken } = require("../../repos/oauth");
const { discordRequest, canManageGuild } = require("../../utils/discord");
const { GuildConfigSchema } = require("../../schemas/guildConfig");
const { ensureGuild, getGuildConfig, upsertGuildConfig, getGuild } = require("../../repos/guilds");
const { cache } = require("../../utils/cache");
const { requestQueue } = require("../../utils/requestQueue");

async function ensureManageGuildPermission(userId, guildId) {
  const cacheKey = `guilds:${userId}`;
  
  // Try to get guilds from cache first
  let guilds = cache.get(cacheKey);
  
  if (!guilds) {
    const token = await getDiscordAccessToken(userId);
    if (!token) return { ok: false, code: "NO_DISCORD_TOKEN" };
    const { status, data } = await discordRequest("/users/@me/guilds", { accessToken: token });
    if (status >= 400 || !Array.isArray(data)) return { ok: false, code: "DISCORD_UPSTREAM_ERROR" };
    guilds = data;
    // Cache for 60 seconds
    cache.set(cacheKey, guilds, 60000);
  }
  
  const g = guilds.find(x => x.id === guildId);
  if (!g) return { ok: false, code: "NOT_IN_GUILD" };
  if (!canManageGuild(g.permissions)) return { ok: false, code: "FORBIDDEN" };
  return { ok: true };
}

/**
 * Guild detail and config routes
 * @param {import('fastify').FastifyInstance} fastify
 */
async function guildConfigRoutes(fastify) {
  // GET /v1/guilds/:guildId -> basic info from API DB (ensures record exists)
  fastify.get("/guilds/:guildId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.auth.userId;
    const guildId = request.params.guildId;
    if (!request.auth?.service) {
      const perm = await ensureManageGuildPermission(userId, guildId);
      if (!perm.ok) {
        const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
        reply.code(status).send({ error: { message: perm.code, code: perm.code } });
        return;
      }
    }

    const guild = await ensureGuild(guildId);
    return { guild: { id: guild.id, createdAt: guild.createdAt } };
  });

  // GET /v1/guilds/:guildId/config
  fastify.get("/guilds/:guildId/config", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.auth.userId;
    const guildId = request.params.guildId;
    const cacheKey = `guild-config:${guildId}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return { config: cached };
    }

    return requestQueue.execute(cacheKey, async () => {
      // Double-check cache
      const cached = cache.get(cacheKey);
      if (cached) {
        return { config: cached };
      }

      if (!request.auth?.service) {
        const perm = await ensureManageGuildPermission(userId, guildId);
        if (!perm.ok) {
          const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
          reply.code(status).send({ error: { message: perm.code, code: perm.code } });
          return;
        }
      }

      await ensureGuild(guildId);
      const cfg = await getGuildConfig(guildId);
      
      // Cache for 30 seconds
      cache.set(cacheKey, cfg, 30000);
      
      return { config: cfg };
    });
  });

  // PUT /v1/guilds/:guildId/config
  fastify.put("/guilds/:guildId/config", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.auth.userId;
    const guildId = request.params.guildId;
    if (!request.auth?.service) {
      const perm = await ensureManageGuildPermission(userId, guildId);
      if (!perm.ok) {
        const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
        reply.code(status).send({ error: { message: perm.code, code: perm.code } });
        return;
      }
    }

    const parse = GuildConfigSchema.safeParse(request.body);
    if (!parse.success) {
      reply.code(400).send({ error: { message: "Invalid config", code: "VALIDATION_ERROR", details: parse.error.flatten() } });
      return;
    }

    await ensureGuild(guildId);
    const updated = await upsertGuildConfig(guildId, parse.data);
    
    // Invalidate cache after update
    const cacheKey = `guild-config:${guildId}`;
    cache.delete(cacheKey);
    
    return { config: updated };
  });
}

module.exports = guildConfigRoutes;

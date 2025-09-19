"use strict";

const { requireAuth } = require("../../middlewares/auth");
const { ensureGuild } = require("../../repos/guilds");
const { getSystemSettings, upsertSystemSettings } = require("../../repos/settings");
const { LevelingSettingsSchema } = require("../../schemas/settings/leveling");
const { WarnsSettingsSchema } = require("../../schemas/settings/warns");
const { EconomySettingsSchema } = require("../../schemas/settings/economy");
const { getDiscordAccessToken } = require("../../repos/oauth");
const { discordRequest, canManageGuild } = require("../../utils/discord");

function schemaFor(system) {
  if (system === "leveling") return LevelingSettingsSchema;
  if (system === "warns") return WarnsSettingsSchema;
  if (system === "economy") return EconomySettingsSchema;
  return null;
}

async function ensureManageGuildPermission(fastify, userId, guildId) {
  const token = await getDiscordAccessToken(userId);
  if (!token) return { ok: false, code: "NO_DISCORD_TOKEN" };
  const { status, data } = await discordRequest("/users/@me/guilds", { accessToken: token });
  if (status >= 400 || !Array.isArray(data)) return { ok: false, code: "DISCORD_UPSTREAM_ERROR" };
  const g = data.find(x => x.id === guildId);
  if (!g) return { ok: false, code: "NOT_IN_GUILD" };
  if (!canManageGuild(g.permissions)) return { ok: false, code: "FORBIDDEN" };
  return { ok: true };
}

/**
 * Settings routes for systems like leveling, warns
 * GET /v1/guilds/:guildId/settings/:system
 * PUT /v1/guilds/:guildId/settings/:system
 * system in { leveling, warns }
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
async function settingsRoutes(fastify) {
  fastify.get("/guilds/:guildId/settings/:system", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, system } = request.params;
    const schema = schemaFor(system);
    if (!schema) {
      reply.code(400).send({ error: { message: "Unknown system", code: "UNKNOWN_SYSTEM" } });
      return;
    }

    if (!request.auth?.service) {
      const perm = await ensureManageGuildPermission(fastify, request.auth.userId, guildId);
      if (!perm.ok) {
        const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
        reply.code(status).send({ error: { message: perm.code, code: perm.code } });
        return;
      }
    }

    await ensureGuild(guildId);
    let value = await getSystemSettings(guildId, system);
    if (value == null) {
      // Initialize with defaults from schema
      const defaults = schema.parse({});
      value = await upsertSystemSettings(guildId, system, defaults);
    }
    return { settings: value };
  });

  fastify.put("/guilds/:guildId/settings/:system", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, system } = request.params;
    const schema = schemaFor(system);
    if (!schema) {
      reply.code(400).send({ error: { message: "Unknown system", code: "UNKNOWN_SYSTEM" } });
      return;
    }

    if (!request.auth?.service) {
      const perm = await ensureManageGuildPermission(fastify, request.auth.userId, guildId);
      if (!perm.ok) {
        const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
        reply.code(status).send({ error: { message: perm.code, code: perm.code } });
        return;
      }
    }

    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      reply.code(400).send({ error: { message: "Invalid settings", code: "VALIDATION_ERROR", details: parse.error.flatten() } });
      return;
    }

    await ensureGuild(guildId);
    const updated = await upsertSystemSettings(guildId, system, parse.data);
    return { settings: updated };
  });
}

module.exports = settingsRoutes;

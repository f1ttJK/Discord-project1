"use strict";

const { requireAuth } = require("../../middlewares/auth");
const { ensureGuild } = require("../../repos/guilds");
const { listWarns, createWarn, revokeWarn } = require("../../repos/warns");

module.exports = async function (fastify, _opts) {
  fastify.addHook("preHandler", requireAuth);

  // List warns (optionally by userId)
  fastify.get("/guilds/:guildId/warns", async (request, reply) => {
    try {
      const { guildId } = request.params;
      const { userId } = request.query ?? {};
      await ensureGuild(guildId);
      const warns = await listWarns(guildId, userId);
      return { warns };
    } catch (e) {
      request.log.error({ err: e }, "warns_list_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  // Create warn
  fastify.post("/guilds/:guildId/warns", async (request, reply) => {
    try {
      const { guildId } = request.params;
      await ensureGuild(guildId);
      const { userId, moderatorId, reason, expiresAt } = request.body || {};
      if (!userId || !moderatorId) {
        reply.code(400);
        return { error: { code: "INVALID_PAYLOAD", message: "userId and moderatorId are required" } };
      }
      const warn = await createWarn({ guildId, userId, moderatorId, reason, expiresAt: expiresAt ? new Date(expiresAt) : null });
      return { warn };
    } catch (e) {
      request.log.error({ err: e }, "warns_create_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  // Revoke warn
  fastify.post("/guilds/:guildId/warns/:id/revoke", async (request, reply) => {
    try {
      const { guildId, id } = request.params;
      await ensureGuild(guildId);
      const { revokedBy, revokeReason } = request.body || {};
      if (!revokedBy) {
        reply.code(400);
        return { error: { code: "INVALID_PAYLOAD", message: "revokedBy is required" } };
      }
      const warn = await revokeWarn(guildId, Number(id), { revokedBy, revokeReason });
      if (!warn) {
        reply.code(404);
        return { error: { code: "NOT_FOUND" } };
      }
      return { warn };
    } catch (e) {
      request.log.error({ err: e }, "warns_revoke_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });
};

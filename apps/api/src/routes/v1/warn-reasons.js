"use strict";

const { requireAuth } = require("../../middlewares/auth");
const { ensureGuild } = require("../../repos/guilds");
const { listReasons, createReason, updateReason, deleteReason } = require("../../repos/warn-reasons");

module.exports = async function (fastify, _opts) {
  fastify.addHook("preHandler", requireAuth);

  fastify.get("/guilds/:guildId/warn-reasons", async (request, reply) => {
    try {
      const { guildId } = request.params;
      const { q, active } = request.query || {};
      await ensureGuild(guildId);
      const reasons = await listReasons(guildId, { search: q, activeOnly: active === 'true' });
      return { reasons };
    } catch (e) {
      request.log.error({ err: e }, "warn_reasons_list_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  fastify.post("/guilds/:guildId/warn-reasons", async (request, reply) => {
    try {
      const { guildId } = request.params;
      await ensureGuild(guildId);
      const { label, description, active } = request.body || {};
      if (!label || typeof label !== 'string') {
        reply.code(400);
        return { error: { code: "INVALID_PAYLOAD", message: "label is required" } };
      }
      const reason = await createReason(guildId, { label, description, active });
      return { reason };
    } catch (e) {
      if (e?.code === 'P2002') {
        reply.code(409);
        return { error: { code: "DUPLICATE", message: "Reason with this label already exists" } };
      }
      request.log.error({ err: e }, "warn_reasons_create_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  fastify.put("/guilds/:guildId/warn-reasons/:id", async (request, reply) => {
    try {
      const { guildId, id } = request.params;
      await ensureGuild(guildId);
      const updated = await updateReason(guildId, Number(id), request.body || {});
      if (!updated) {
        reply.code(404);
        return { error: { code: "NOT_FOUND" } };
      }
      return { reason: updated };
    } catch (e) {
      if (e?.code === 'P2002') {
        reply.code(409);
        return { error: { code: "DUPLICATE", message: "Reason with this label already exists" } };
      }
      request.log.error({ err: e }, "warn_reasons_update_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  fastify.delete("/guilds/:guildId/warn-reasons/:id", async (request, reply) => {
    try {
      const { guildId, id } = request.params;
      await ensureGuild(guildId);
      const ok = await deleteReason(guildId, Number(id));
      if (!ok) {
        reply.code(404);
        return { error: { code: "NOT_FOUND" } };
      }
      return { ok: true };
    } catch (e) {
      request.log.error({ err: e }, "warn_reasons_delete_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });
};

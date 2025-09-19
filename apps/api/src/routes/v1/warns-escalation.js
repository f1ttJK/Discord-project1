"use strict";

const { requireAuth } = require("../../middlewares/auth");
const { ensureGuild } = require("../../repos/guilds");
const { listRules, createRule, updateRule, deleteRule } = require("../../repos/warns-escalation");
const { WarnEscalationRuleSchema } = require("../../schemas/warns/escalation");

module.exports = async function (fastify, _opts) {
  fastify.addHook("preHandler", requireAuth);

  // List rules
  fastify.get("/guilds/:guildId/warns/escalation", async (request, reply) => {
    try {
      const { guildId } = request.params;
      await ensureGuild(guildId);
      const rules = await listRules(guildId);
      return { rules };
    } catch (e) {
      request.log.error({ err: e }, "warns_escalation_list_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  // Create rule
  fastify.post("/guilds/:guildId/warns/escalation", async (request, reply) => {
    const { guildId } = request.params;
    await ensureGuild(guildId);
    const parse = WarnEscalationRuleSchema.safeParse(request.body);
    if (!parse.success) {
      reply.code(400);
      return { error: { code: "INVALID_PAYLOAD", issues: parse.error.issues } };
    }
    try {
      const rule = await createRule(guildId, parse.data);
      return { rule };
    } catch (e) {
      if (e?.code === 'P2002') {
        reply.code(409);
        return { error: { code: "DUPLICATE_RULE", message: "Правило с таким count уже существует." } };
      }
      request.log.error({ err: e }, "warns_escalation_create_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  // Update rule
  fastify.put("/guilds/:guildId/warns/escalation/:id", async (request, reply) => {
    const { guildId, id } = request.params;
    await ensureGuild(guildId);
    const parse = WarnEscalationRuleSchema.partial().safeParse(request.body);
    if (!parse.success) {
      reply.code(400);
      return { error: { code: "INVALID_PAYLOAD", issues: parse.error.issues } };
    }
    try {
      const updated = await updateRule(guildId, Number(id), parse.data);
      if (!updated) {
        reply.code(404);
        return { error: { code: "NOT_FOUND" } };
      }
      return { rule: updated };
    } catch (e) {
      if (e?.code === 'P2002') {
        reply.code(409);
        return { error: { code: "DUPLICATE_RULE", message: "Правило с таким count уже существует." } };
      }
      request.log.error({ err: e }, "warns_escalation_update_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });

  // Delete rule
  fastify.delete("/guilds/:guildId/warns/escalation/:id", async (request, reply) => {
    try {
      const { guildId, id } = request.params;
      await ensureGuild(guildId);
      const ok = await deleteRule(guildId, Number(id));
      if (!ok) {
        reply.code(404);
        return { error: { code: "NOT_FOUND" } };
      }
      return { ok: true };
    } catch (e) {
      request.log.error({ err: e }, "warns_escalation_delete_error");
      reply.code(500);
      return { error: { code: "INTERNAL_ERROR" } };
    }
  });
};

"use strict";

const { getPrisma } = require("./prisma");

async function listRules(guildId) {
  const prisma = getPrisma();
  return prisma.warnEscalationRule.findMany({
    where: { guildId },
    orderBy: { order: "asc" },
    select: { id: true, guildId: true, count: true, action: true, durationMinutes: true, order: true },
  });
}

async function createRule(guildId, data) {
  const prisma = getPrisma();
  // Determine order if not provided
  const count = await prisma.warnEscalationRule.count({ where: { guildId } });
  const order = typeof data.order === "number" ? data.order : count;
  return prisma.warnEscalationRule.create({
    data: { guildId, count: data.count, action: data.action, durationMinutes: data.durationMinutes ?? null, order },
    select: { id: true, guildId: true, count: true, action: true, durationMinutes: true, order: true },
  });
}

async function updateRule(guildId, id, data) {
  const prisma = getPrisma();
  // Ensure rule belongs to guild
  const exists = await prisma.warnEscalationRule.findFirst({ where: { id, guildId } });
  if (!exists) return null;
  return prisma.warnEscalationRule.update({
    where: { id },
    data: {
      count: typeof data.count === "number" ? data.count : exists.count,
      action: data.action ?? exists.action,
      durationMinutes: data.durationMinutes === undefined ? exists.durationMinutes : data.durationMinutes,
      order: typeof data.order === "number" ? data.order : exists.order,
    },
    select: { id: true, guildId: true, count: true, action: true, durationMinutes: true, order: true },
  });
}

async function deleteRule(guildId, id) {
  const prisma = getPrisma();
  const exists = await prisma.warnEscalationRule.findFirst({ where: { id, guildId } });
  if (!exists) return false;
  await prisma.warnEscalationRule.delete({ where: { id } });
  return true;
}

module.exports = { listRules, createRule, updateRule, deleteRule };

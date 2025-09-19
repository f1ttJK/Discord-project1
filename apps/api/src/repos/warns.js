"use strict";

const { getPrisma } = require("./prisma");

async function listWarns(guildId, userId) {
  const prisma = getPrisma();
  return prisma.warn.findMany({
    where: { guildId, ...(userId ? { userId } : {}) },
    orderBy: { id: "desc" },
    select: {
      id: true, guildId: true, userId: true, moderatorId: true,
      reason: true, createdAt: true, expiresAt: true,
      revokedAt: true, revokedBy: true, revokeReason: true,
    },
  });
}

async function createWarn({ guildId, userId, moderatorId, reason, expiresAt }) {
  const prisma = getPrisma();
  return prisma.warn.create({
    data: { guildId, userId, moderatorId, reason: reason ?? null, expiresAt: expiresAt ?? null },
    select: {
      id: true, guildId: true, userId: true, moderatorId: true,
      reason: true, createdAt: true, expiresAt: true,
      revokedAt: true, revokedBy: true, revokeReason: true,
    },
  });
}

async function revokeWarn(guildId, id, { revokedBy, revokeReason }) {
  const prisma = getPrisma();
  const exists = await prisma.warn.findFirst({ where: { id, guildId }, select: { id: true, revokedAt: true } });
  if (!exists) return null;
  const updated = await prisma.warn.update({
    where: { id },
    data: { revokedAt: new Date(), revokedBy, revokeReason: revokeReason ?? null },
    select: {
      id: true, guildId: true, userId: true, moderatorId: true,
      reason: true, createdAt: true, expiresAt: true,
      revokedAt: true, revokedBy: true, revokeReason: true,
    },
  });
  return updated;
}

module.exports = { listWarns, createWarn, revokeWarn };

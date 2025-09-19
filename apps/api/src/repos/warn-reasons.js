"use strict";

const { getPrisma } = require("./prisma");

async function listReasons(guildId, { search, activeOnly } = {}) {
  const prisma = getPrisma();
  const q = typeof search === 'string' ? search.toLowerCase() : '';
  // Backfill labelLower for legacy rows (once)
  try {
    const legacy = await prisma.warnReason.findMany({ where: { guildId, OR: [{ labelLower: null }, { labelLower: '' }] }, select: { id: true, label: true } });
    for (const r of legacy) {
      try {
        await prisma.warnReason.update({ where: { id: r.id }, data: { labelLower: String(r.label || '').toLowerCase() } });
      } catch {}
    }
  } catch {}
  return prisma.warnReason.findMany({
    where: {
      guildId,
      ...(activeOnly ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { labelLower: { contains: q } },
              { label: { contains: search } }, // fallback for legacy rows without labelLower
            ],
          }
        : {}),
    },
    orderBy: { id: 'asc' },
    select: { id: true, guildId: true, label: true, description: true, active: true },
    take: 50,
  });
}

async function createReason(guildId, { label, description, active = true }) {
  const prisma = getPrisma();
  const base = { guildId, label, description: description ?? null, active };
  try {
    return await prisma.warnReason.create({
      data: { ...base, labelLower: String(label).toLowerCase() },
      select: { id: true, guildId: true, label: true, description: true, active: true },
    });
  } catch (e) {
    // Fallback when labelLower column is not yet applied
    return prisma.warnReason.create({
      data: base,
      select: { id: true, guildId: true, label: true, description: true, active: true },
    });
  }
}

async function updateReason(guildId, id, data) {
  const prisma = getPrisma();
  const exists = await prisma.warnReason.findFirst({ where: { id, guildId } });
  if (!exists) return null;
  const next = {
    label: data.label ?? exists.label,
    description: data.description === undefined ? exists.description : data.description,
    active: typeof data.active === 'boolean' ? data.active : exists.active,
  };
  try {
    return await prisma.warnReason.update({
      where: { id },
      data: { ...next, labelLower: data.label ? String(data.label).toLowerCase() : exists.labelLower },
      select: { id: true, guildId: true, label: true, description: true, active: true },
    });
  } catch (e) {
    // Fallback when labelLower column is not yet applied
    return prisma.warnReason.update({
      where: { id },
      data: next,
      select: { id: true, guildId: true, label: true, description: true, active: true },
    });
  }
}

async function deleteReason(guildId, id) {
  const prisma = getPrisma();
  const exists = await prisma.warnReason.findFirst({ where: { id, guildId } });
  if (!exists) return false;
  await prisma.warnReason.delete({ where: { id } });
  return true;
}

module.exports = { listReasons, createReason, updateReason, deleteReason };

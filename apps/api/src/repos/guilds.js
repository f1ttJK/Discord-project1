"use strict";

const { getPrisma } = require("./prisma");

function parseMaybeJson(str) {
  if (str == null) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function stringifyMaybeJson(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}

async function getGuild(guildId) {
  const prisma = getPrisma();
  return prisma.guild.findUnique({ where: { id: guildId } });
}

async function ensureGuild(guildId) {
  const prisma = getPrisma();
  return prisma.guild.upsert({
    where: { id: guildId },
    update: {},
    create: { id: guildId },
  });
}

async function getGuildConfig(guildId) {
  const prisma = getPrisma();
  const cfg = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!cfg) return null;
  return {
    guildId: cfg.guildId,
    levelingEnabled: cfg.levelingEnabled,
    curve: cfg.curve,
    antiAbuse: parseMaybeJson(cfg.antiAbuse),
    roleRewards: parseMaybeJson(cfg.roleRewards),
    locale: cfg.locale,
  };
}

async function upsertGuildConfig(guildId, input) {
  const prisma = getPrisma();
  const data = {
    guildId,
    levelingEnabled: input.levelingEnabled,
    curve: input.curve,
    antiAbuse: stringifyMaybeJson(input.antiAbuse),
    roleRewards: stringifyMaybeJson(input.roleRewards),
    locale: input.locale,
  };
  const cfg = await prisma.guildConfig.upsert({
    where: { guildId },
    update: data,
    create: data,
  });
  return {
    guildId: cfg.guildId,
    levelingEnabled: cfg.levelingEnabled,
    curve: cfg.curve,
    antiAbuse: parseMaybeJson(cfg.antiAbuse),
    roleRewards: parseMaybeJson(cfg.roleRewards),
    locale: cfg.locale,
  };
}

module.exports = { getGuild, ensureGuild, getGuildConfig, upsertGuildConfig };

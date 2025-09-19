"use strict";

const { getPrisma } = require("./prisma");

function parse(str) { if (str == null) return null; try { return JSON.parse(str); } catch { return null; } }
function stringify(obj) { if (obj == null) return null; return JSON.stringify(obj); }

async function getSystemSettings(guildId, system) {
  const prisma = getPrisma();
  const row = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!row) return null;
  if (system === 'leveling') return parse(row.leveling);
  if (system === 'warns') return parse(row.warns);
  if (system === 'economy') return parse(row.economy);
  return null;
}

async function upsertSystemSettings(guildId, system, value) {
  const prisma = getPrisma();
  const data = { guildId };
  if (system === 'leveling') data.leveling = stringify(value);
  if (system === 'warns') data.warns = stringify(value);
  if (system === 'economy') data.economy = stringify(value);

  const row = await prisma.guildSettings.upsert({
    where: { guildId },
    update: data,
    create: data,
  });
  return getSystemSettings(guildId, system);
}

module.exports = { getSystemSettings, upsertSystemSettings };

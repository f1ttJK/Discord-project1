"use strict";

const { requireAuth } = require("../../middlewares/auth");

// In-memory stores (dev only)
const levelConfigs = new Map(); // guildId -> { voiceCooldown: number, roleStacking: boolean }
const ignores = new Map(); // guildId -> { Channel: Set<string>, User: Set<string>, Role: Set<string> }
const levelRoles = new Map(); // guildId -> Array<{ roleId, minLevel, order }>
const members = new Map(); // `${guildId}:${userId}` -> { xp, level, msgCount, voiceSeconds }

const DEFAULT_CFG = { voiceCooldown: 60, roleStacking: true };

function gkey(guildId, userId) { return `${guildId}:${userId}`; }
function getCfg(guildId) { return levelConfigs.get(guildId) || DEFAULT_CFG; }
function setCfg(guildId, cfg) { levelConfigs.set(guildId, { ...DEFAULT_CFG, ...cfg }); }
function getIg(guildId) {
  if (!ignores.has(guildId)) ignores.set(guildId, { Channel: new Set(), User: new Set(), Role: new Set() });
  return ignores.get(guildId);
}
function setIg(guildId, data) {
  const base = getIg(guildId);
  const toSet = (arr) => new Set(Array.isArray(arr) ? arr.map(String) : []);
  if (data.Channel) base.Channel = toSet(data.Channel);
  if (data.User) base.User = toSet(data.User);
  if (data.Role) base.Role = toSet(data.Role);
  ignores.set(guildId, base);
}
function getRoles(guildId) { return levelRoles.get(guildId) || []; }
function setRoles(guildId, list) {
  const normalized = (Array.isArray(list) ? list : []).map((r, i) => ({
    roleId: String(r.roleId),
    minLevel: Number(r.minLevel ?? 1),
    order: Number(r.order ?? i + 1),
  })).sort((a, b) => a.order - b.order);
  levelRoles.set(guildId, normalized);
}
function getMember(guildId, userId) {
  const k = gkey(guildId, userId);
  if (!members.has(k)) members.set(k, { xp: 0, level: 0, msgCount: 0, voiceSeconds: 0 });
  return members.get(k);
}

function levelForXp(xp) {
  // Simple curve: level n when xp >= 100 * n^2
  let lvl = 0;
  while ((lvl + 1) * (lvl + 1) * 100 <= xp) lvl++;
  return lvl;
}

async function levelingRoutes(fastify) {
  // Read config/roles/ignores
  fastify.get("/leveling/:guildId/roles", { preHandler: [requireAuth] }, async (request) => {
    const { guildId } = request.params;
    return { config: getCfg(guildId), rules: getRoles(guildId) };
  });
  fastify.post("/leveling/:guildId/roles", { preHandler: [requireAuth] }, async (request) => {
    const { guildId } = request.params;
    const { config, rules } = request.body || {};
    if (config) setCfg(guildId, config);
    if (rules) setRoles(guildId, rules);
    return { ok: true };
  });
  fastify.get("/leveling/:guildId/ignores", { preHandler: [requireAuth] }, async (request) => {
    const { guildId } = request.params;
    const ig = getIg(guildId);
    return { Channel: [...ig.Channel], User: [...ig.User], Role: [...ig.Role] };
  });
  fastify.post("/leveling/:guildId/ignores", { preHandler: [requireAuth] }, async (request) => {
    const { guildId } = request.params;
    setIg(guildId, request.body || {});
    return { ok: true };
  });

  // Member stats
  fastify.get("/leveling/:guildId/member/:userId", { preHandler: [requireAuth] }, async (request) => {
    const { guildId, userId } = request.params;
    return getMember(guildId, userId);
  });

  // Leaderboard
  fastify.get("/leveling/:guildId/top", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId } = request.params;
    const { category = 'levels', page = 1, pageSize = 10 } = request.query || {};
    const p = Math.max(1, Number(page));
    const sz = Math.min(50, Math.max(1, Number(pageSize)));
    // Collect all members of this guild
    const rows = [];
    for (const [k, v] of members.entries()) {
      if (!k.startsWith(`${guildId}:`)) continue;
      const userId = k.split(':')[1];
      rows.push({ userId, ...v });
    }
    let sorter;
    if (category === 'levels') sorter = (a, b) => (b.xp ?? 0) - (a.xp ?? 0);
    else if (category === 'voice') sorter = (a, b) => (b.voiceSeconds ?? 0) - (a.voiceSeconds ?? 0);
    else if (category === 'text') sorter = (a, b) => (b.msgCount ?? 0) - (a.msgCount ?? 0);
    else return reply.code(400).send({ error: { code: 'BAD_CATEGORY' } });
    rows.sort(sorter);
    const total = rows.length;
    const start = (p - 1) * sz;
    const pageRows = rows.slice(start, start + sz);
    return { total, page: p, pageSize: sz, rows: pageRows };
  });

  // Accrual: message
  fastify.post("/leveling/message", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, userId, channelId, contentLen = 0 } = request.body || {};
    if (!guildId || !userId) return reply.code(400).send({ error: { code: 'BAD_PAYLOAD' } });
    const ig = getIg(guildId);
    if (channelId && ig.Channel.has(String(channelId))) return reply.code(204).send();
    if (ig.User.has(String(userId))) return reply.code(204).send();
    const m = getMember(guildId, userId);
    m.msgCount += 1;
    // very simple anti-spam: min len 2 already на стороне бота; тут +5 XP
    const before = m.level;
    m.xp += 5;
    const after = levelForXp(m.xp);
    let leveledUp = false;
    if (after > before) { m.level = after; leveledUp = true; }
    return reply.code(200).send({ leveledUp, level: m.level, xp: m.xp });
  });

  // Accrual: voice
  fastify.post("/leveling/voice", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, userId, seconds = 0, channelId } = request.body || {};
    if (!guildId || !userId) return reply.code(400).send({ error: { code: 'BAD_PAYLOAD' } });
    const ig = getIg(guildId);
    if (channelId && ig.Channel.has(String(channelId))) return reply.code(204).send();
    if (ig.User.has(String(userId))) return reply.code(204).send();
    const cfg = getCfg(guildId);
    const m = getMember(guildId, userId);
    if (seconds > 0) m.voiceSeconds += Math.floor(seconds);
    // Apply voiceCooldown as minimum session length to earn XP
    let eligible = Math.floor(seconds);
    if (cfg.voiceCooldown > 0 && eligible < cfg.voiceCooldown) eligible = 0;
    const minutes = Math.floor(eligible / 60);
    const perMin = 2;
    const before = m.level;
    if (minutes > 0) m.xp += minutes * perMin * 5; // per-minute weighs 5x a message
    const after = levelForXp(m.xp);
    let leveledUp = false;
    if (after > before) { m.level = after; leveledUp = true; }
    return reply.code(200).send({ leveledUp, level: m.level, xp: m.xp, addedXp: m.xp - (before*before*100) });
  });
}

module.exports = levelingRoutes;

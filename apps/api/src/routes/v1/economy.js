"use strict";

const { requireAuth } = require("../../middlewares/auth");

// In-memory economy store (dev-only). For production, back with a real DB.
// Key: `${guildId}:${userId}` -> { cur1, cur2, lastDailyAt, lastWeeklyAt }
const balances = new Map();
// Track total cur1 per guild for price calc
const guildTotals = new Map(); // guildId -> totalCur1

const BASE_PRICE = 100; // base price for cur2 in cur1
const SLOPE = 0.001; // price increases with total cur1

function key(guildId, userId) { return `${guildId}:${userId}`; }
function getBal(guildId, userId) {
  const k = key(guildId, userId);
  if (!balances.has(k)) balances.set(k, { cur1: 0, cur2: 0, lastDailyAt: 0, lastWeeklyAt: 0 });
  return balances.get(k);
}
function getGuildTotal(guildId) { return guildTotals.get(guildId) ?? 0; }
function setGuildTotal(guildId, total) { guildTotals.set(guildId, Math.max(0, total)); }
function priceFor(guildId) { return BASE_PRICE + SLOPE * getGuildTotal(guildId); }

async function economyRoutes(fastify) {
  // GET balance
  fastify.get("/economy/:guildId/:userId/balance", { preHandler: [requireAuth] }, async (request) => {
    const { guildId, userId } = request.params;
    const bal = getBal(guildId, userId);
    return { cur1: bal.cur1, cur2: bal.cur2, price: priceFor(guildId) };
  });

  // POST earn { amount }
  fastify.post("/economy/:guildId/:userId/earn", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, userId } = request.params;
    const { amount } = request.body || {};
    const inc = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 10;
    const bal = getBal(guildId, userId);
    bal.cur1 += inc;
    setGuildTotal(guildId, getGuildTotal(guildId) + inc);
    return reply.code(200).send({ cur1: bal.cur1, cur2: bal.cur2, added: inc, price: priceFor(guildId) });
  });

  // POST daily
  fastify.post("/economy/:guildId/:userId/daily", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, userId } = request.params;
    const bal = getBal(guildId, userId);
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const reward = 100;
    if (bal.lastDailyAt && now - bal.lastDailyAt < DAY) {
      const nextIn = bal.lastDailyAt + DAY - now;
      return reply.code(429).send({ error: { code: 'DAILY_COOLDOWN', nextInMs: nextIn } });
    }
    bal.lastDailyAt = now;
    bal.cur1 += reward;
    setGuildTotal(guildId, getGuildTotal(guildId) + reward);
    return { cur1: bal.cur1, cur2: bal.cur2, added: reward, price: priceFor(guildId) };
  });

  // POST weekly
  fastify.post("/economy/:guildId/:userId/weekly", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, userId } = request.params;
    const bal = getBal(guildId, userId);
    const now = Date.now();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const reward = 500;
    if (bal.lastWeeklyAt && now - bal.lastWeeklyAt < WEEK) {
      const nextIn = bal.lastWeeklyAt + WEEK - now;
      return reply.code(429).send({ error: { code: 'WEEKLY_COOLDOWN', nextInMs: nextIn } });
    }
    bal.lastWeeklyAt = now;
    bal.cur1 += reward;
    setGuildTotal(guildId, getGuildTotal(guildId) + reward);
    return { cur1: bal.cur1, cur2: bal.cur2, added: reward, price: priceFor(guildId) };
  });

  fastify.post("/economy/:guildId/transaction", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId } = request.params;
    const entries = request.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return reply.code(400).send({ error: { code: "NO_ENTRIES", message: "entries must be a non-empty array" } });
    }

    const aggregated = new Map();
    for (const entry of entries) {
      const rawId = entry?.userId;
      const userId = typeof rawId === "string" ? rawId.trim() : typeof rawId === "number" ? String(rawId) : "";
      if (!userId) {
        return reply.code(400).send({ error: { code: "BAD_ENTRY", message: "userId is required" } });
      }
      const deltaNum = Number(entry?.delta);
      if (!Number.isFinite(deltaNum) || !Number.isInteger(deltaNum)) {
        return reply.code(400).send({ error: { code: "BAD_ENTRY", message: "delta must be an integer", userId } });
      }
      const prev = aggregated.get(userId) ?? 0;
      aggregated.set(userId, prev + deltaNum);
    }

    if (aggregated.size === 0) {
      return reply.code(400).send({ error: { code: "NO_EFFECT", message: "no valid transaction entries" } });
    }

    for (const [userId, delta] of aggregated) {
      const bal = getBal(guildId, userId);
      const next = bal.cur1 + delta;
      if (next < 0) {
        return reply.code(400).send({ error: { code: "INSUFFICIENT_FUNDS", message: "Insufficient funds", details: { userId, balance: bal.cur1, required: -delta } } });
      }
    }

    let totalDelta = 0;
    const result = {};
    for (const [userId, delta] of aggregated) {
      const bal = getBal(guildId, userId);
      if (delta !== 0) {
        bal.cur1 += delta;
        totalDelta += delta;
      }
      result[userId] = { cur1: bal.cur1, cur2: bal.cur2 };
    }

    if (totalDelta !== 0) {
      setGuildTotal(guildId, getGuildTotal(guildId) + totalDelta);
    }

    return { balances: result };
  });
  // POST exchange { direction: 'cur1_to_cur2'|'cur2_to_cur1', amount }
  fastify.post("/economy/:guildId/:userId/exchange", { preHandler: [requireAuth] }, async (request, reply) => {
    const { guildId, userId } = request.params;
    const { direction, amount } = request.body || {};
    const amt = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
    if (amt <= 0) return reply.code(400).send({ error: { code: 'BAD_AMOUNT', message: 'amount must be > 0' } });
    const bal = getBal(guildId, userId);
    const p = priceFor(guildId);

    if (direction === 'cur1_to_cur2') {
      const cost = amt * p;
      if (bal.cur1 < cost) return reply.code(400).send({ error: { code: 'INSUFFICIENT_CUR1' } });
      bal.cur1 -= cost;
      bal.cur2 += amt;
      setGuildTotal(guildId, getGuildTotal(guildId) - cost);
    } else if (direction === 'cur2_to_cur1') {
      if (bal.cur2 < amt) return reply.code(400).send({ error: { code: 'INSUFFICIENT_CUR2' } });
      bal.cur2 -= amt;
      const gain = amt * p;
      bal.cur1 += gain;
      setGuildTotal(guildId, getGuildTotal(guildId) + gain);
    } else {
      return reply.code(400).send({ error: { code: 'BAD_DIRECTION' } });
    }
    return { cur1: bal.cur1, cur2: bal.cur2, price: priceFor(guildId) };
  });
}

module.exports = economyRoutes;


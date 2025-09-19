"use strict";

const { apiRequest } = require("./ApiClient");

function normalizeId(id) {
  if (typeof id === "string" && id.trim().length > 0) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  throw new Error("Invalid userId");
}

function ensureInt(value, { min } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error("Amount must be an integer");
  }
  if (typeof min === "number" && num < min) {
    throw new Error(`Amount must be >= ${min}`);
  }
  return num;
}

function EconomyService() {
  async function getBalance(guildId, userId) {
    const gid = normalizeId(guildId);
    const uid = normalizeId(userId);
    const res = await apiRequest(`/v1/economy/${gid}/${uid}/balance`);
    return {
      cur1: Number((res && res.cur1 != null) ? res.cur1 : 0),
      cur2: Number((res && res.cur2 != null) ? res.cur2 : 0),
      price: Number((res && res.price != null) ? res.price : 0),
    };
  }

  async function daily(guildId, userId) {
    const gid = normalizeId(guildId);
    const uid = normalizeId(userId);
    return apiRequest(`/v1/economy/${gid}/${uid}/daily`, { method: "POST" });
  }

  async function weekly(guildId, userId) {
    const gid = normalizeId(guildId);
    const uid = normalizeId(userId);
    return apiRequest(`/v1/economy/${gid}/${uid}/weekly`, { method: "POST" });
  }

  async function earn(guildId, userId, amount) {
    const gid = normalizeId(guildId);
    const uid = normalizeId(userId);
    const amt = ensureInt(amount, { min: 1 });
    return apiRequest(`/v1/economy/${gid}/${uid}/earn`, { method: "POST", body: { amount: amt } });
  }

  async function exchange(guildId, userId, direction, amount) {
    const gid = normalizeId(guildId);
    const uid = normalizeId(userId);
    const amt = ensureInt(amount, { min: 1 });
    const dir = String(direction);
    return apiRequest(`/v1/economy/${gid}/${uid}/exchange`, { method: "POST", body: { direction: dir, amount: amt } });
  }

  async function transaction(guildId, entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("Transaction entries must be a non-empty array");
    }
    const gid = normalizeId(guildId);
    const body = {
      entries: entries.map((entry) => {
        const eUserId = entry && entry.userId;
        const eDelta = entry && entry.delta;
        const uid = normalizeId(eUserId);
        const delta = ensureInt((eDelta === null || eDelta === undefined) ? 0 : eDelta);
        return { userId: uid, delta };
      }),
    };
    const res = await apiRequest(`/v1/economy/${gid}/transaction`, { method: "POST", body });
    return (res && res.balances) ? res.balances : {};
  }

  async function transfer(guildId, fromUserId, toUserId, amount) {
    const amt = ensureInt(amount, { min: 1 });
    return transaction(guildId, [
      { userId: normalizeId(fromUserId), delta: -amt },
      { userId: normalizeId(toUserId), delta: amt },
    ]);
  }

  return {
    getBalance,
    daily,
    weekly,
    earn,
    exchange,
    transaction,
    transfer,
  };
}

module.exports = EconomyService;


"use strict";

const { randomBytes } = require("crypto");
const { getPrisma } = require("./prisma");

/**
 * Create a new session for a user with TTL in hours.
 * @param {string} userId
 * @param {number} ttlHours
 * @returns {Promise<{id: string, userId: string, expiresAt: Date}>}
 */
async function createSession(userId, ttlHours) {
  const prisma = getPrisma();
  const id = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { id, userId, expiresAt },
  });
  return session;
}

/**
 * Invalidate a session by id.
 * @param {string} id
 */
async function deleteSession(id) {
  const prisma = getPrisma();
  try {
    await prisma.session.delete({ where: { id } });
  } catch (_) {
    // ignore if not found
  }
}

/**
 * Get session by id
 * @param {string} id
 * @returns {Promise<{id: string, userId: string, expiresAt: Date}|null>}
 */
async function getSession(id) {
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({ where: { id } });
  return session ?? null;
}

module.exports = { createSession, deleteSession, getSession };

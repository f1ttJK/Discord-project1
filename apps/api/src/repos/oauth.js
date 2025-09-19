"use strict";

const { getPrisma } = require("./prisma");
const { request: undiciRequest } = require("undici");

/**
 * Upsert Discord user and OAuth account with new tokens
 * @param {Object} params
 * @param {import('undici').Dispatcher.ResponseData} params.profile - Discord user profile { id, username, ... }
 * @param {Object} params.tokens - { accessToken, refreshToken, tokenType, scope, expiresAt }
 */
async function upsertDiscordAccount({ profile, tokens }) {
  const prisma = getPrisma();
  const userId = profile.id;

  // Ensure base User exists
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  // Upsert OAuthAccount by provider+providerAccountId
  const account = await prisma.oAuthAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: "discord",
        providerAccountId: userId,
      },
    },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType ?? null,
      scope: tokens.scope ?? null,
      expiresAt: tokens.expiresAt ?? null,
      userId,
    },
    create: {
      provider: "discord",
      providerAccountId: userId,
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType ?? null,
      scope: tokens.scope ?? null,
      expiresAt: tokens.expiresAt ?? null,
    },
  });

  return account;
}

/**
 * Get the current Discord access token for a user
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getDiscordAccessToken(userId) {
  const prisma = getPrisma();
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: "discord" },
    orderBy: { updatedAt: "desc" },
    select: { accessToken: true, expiresAt: true },
  });
  return account?.accessToken ?? null;
}

/**
 * Get full latest Discord OAuth account for user (includes refreshToken)
 * @param {string} userId
 */
async function getDiscordAccount(userId) {
  const prisma = getPrisma();
  return prisma.oAuthAccount.findFirst({
    where: { userId, provider: "discord" },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Refresh Discord access token using refresh_token grant
 * Updates stored tokens and returns new access token
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.clientId
 * @param {string} params.clientSecret
 * @returns {Promise<string|null>}
 */
async function refreshDiscordToken({ userId, clientId, clientSecret }) {
  const prisma = getPrisma();
  const account = await getDiscordAccount(userId);
  if (!account?.refreshToken) return null;
  const res = await undiciRequest("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }).toString(),
  });
  const text = await res.body.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (res.statusCode >= 400 || !json?.access_token) {
    return null;
  }
  const newAccess = json.access_token;
  const newRefresh = json.refresh_token || account.refreshToken;
  const tokenType = json.token_type ?? account.tokenType;
  const scope = json.scope ?? account.scope;
  const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null;
  await prisma.oAuthAccount.update({
    where: { id: account.id },
    data: {
      accessToken: newAccess,
      refreshToken: newRefresh,
      tokenType,
      scope,
      expiresAt,
    },
  });
  return newAccess;
}

module.exports = { upsertDiscordAccount, getDiscordAccessToken, getDiscordAccount, refreshDiscordToken };

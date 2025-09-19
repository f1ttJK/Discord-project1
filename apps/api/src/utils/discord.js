"use strict";

const { request } = require("undici");
const { cache } = require('./cache');
const { discordApiBreaker } = require('./circuitBreaker');

/**
 * Perform a Discord API request with provided access token.
 * Does not auto-refresh tokens yet (to be implemented later).
 * @param {string} path e.g. "/users/@me/guilds"
 * @param {object} options { method?: string, accessToken: string }
 */
async function discordRequest(endpoint, options = {}) {
  const { accessToken, method = 'GET', body } = options;
  
  return discordApiBreaker.execute(async () => {
    const url = `https://discord.com/api/v10${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com/example/bot, 1.0.0)'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      timeout: 10000 // 10 second timeout
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const error = new Error(`Rate limited. Retry after ${retryAfter}s`);
      error.retryAfter = retryAfter;
      error.status = 429;
      throw error;
    }

    if (response.status >= 500) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    const data = await response.json().catch(() => null);
    
    return {
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  }, () => {
    // Fallback when circuit breaker is open
    return {
      status: 503,
      data: null,
      error: 'Discord API temporarily unavailable'
    };
  });
}

/**
 * Check whether the user can manage the guild by perms bitfield.
 * MANAGE_GUILD bit = 0x20 (32)
 */
function canManageGuild(permissions) {
  // permissions may be string (as in Discord API), convert to BigInt
  try {
    const p = BigInt(permissions);
    return (p & 32n) === 32n;
  } catch {
    return false;
  }
}

module.exports = { discordRequest, canManageGuild };

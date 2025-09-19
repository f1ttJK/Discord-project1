"use strict";

const { apiRequest } = require("./ApiClient");

/**
 * GuildConfigService provides methods for the bot to read/update guild settings
 * stored in the API database.
 */
function GuildConfigService() {
  /**
   * Ensure guild exists in API DB and get basic info
   * @param {string} guildId
   */
  async function ensureGuild(guildId) {
    const res = await apiRequest(`/v1/guilds/${guildId}`);
    return res.guild;
  }

  /**
   * Fetch guild configuration from API
   * @param {string} guildId
   */
  async function getConfig(guildId) {
    const res = await apiRequest(`/v1/guilds/${guildId}/config`);
    return res.config || null;
  }

  /**
   * Update guild configuration in API
   * @param {string} guildId
   * @param {object} partialConfig - fields per API schema (levelingEnabled, curve, antiAbuse, roleRewards, locale)
   */
  async function updateConfig(guildId, partialConfig) {
    const res = await apiRequest(`/v1/guilds/${guildId}/config`, {
      method: "PUT",
      body: partialConfig,
    });
    return res.config;
  }

  async function patchConfig(guildId, patch = {}) {
    const base = await getConfig(guildId).catch(() => null) || {};
    const next = { ...base };
    for (const [key, value] of Object.entries(patch || {})) {
      if (value === undefined) continue;
      next[key] = value;
    }
    const res = await apiRequest(`/v1/guilds/${guildId}/config`, {
      method: "PUT",
      body: next,
    });
    return res.config;
  }
  return { ensureGuild, getConfig, updateConfig, patchConfig };
}

module.exports = GuildConfigService;


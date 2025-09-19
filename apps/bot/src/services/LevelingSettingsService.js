"use strict";

const { apiRequest } = require("./ApiClient");

function LevelingSettingsService() {
  // Adapter over /v1/leveling/:guildId/roles
  // get(): returns object compatible   UI :
  // { roleStacking, voiceCooldown, roleRewards: [{ roleId, level }] }
  async function get(guildId) {
    const res = await apiRequest(`/v1/leveling/${guildId}/roles`);
    const cfg = res?.config || {};
    const rules = Array.isArray(res?.rules) ? res.rules : [];
    return {
      roleStacking: cfg.roleStacking !== false,
      voiceCooldown: Number.isFinite(cfg.voiceCooldown) ? cfg.voiceCooldown : 60,
      roleRewards: rules.map(r => ({ roleId: String(r.roleId), level: Number(r.minLevel ?? r.level ?? 1) })),
    };
  }

  // set(): accepts same shape and maps to API payload
  async function set(guildId, settings) {
    const cfg = {
      roleStacking: settings?.roleStacking !== false,
      voiceCooldown: Number.isFinite(settings?.voiceCooldown) ? settings.voiceCooldown : undefined,
    };
    const rules = Array.isArray(settings?.roleRewards)
      ? settings.roleRewards.map((r, i) => ({ roleId: String(r.roleId), minLevel: Number(r.level ?? 1), order: i + 1 }))
      : undefined;
    const body = { config: cfg, rules };
    await apiRequest(`/v1/leveling/${guildId}/roles`, { method: "POST", body });
    return settings;
  }
  return { get, set };
}

module.exports = LevelingSettingsService;


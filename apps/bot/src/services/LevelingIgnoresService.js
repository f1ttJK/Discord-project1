"use strict";

const { apiRequest } = require("./ApiClient");

function LevelingIgnoresService() {
  async function get(guildId) {
    const res = await apiRequest(`/v1/leveling/${guildId}/ignores`);
    return {
      Channel: Array.isArray(res?.Channel) ? res.Channel.map(String) : [],
      User: Array.isArray(res?.User) ? res.User.map(String) : [],
      Role: Array.isArray(res?.Role) ? res.Role.map(String) : [],
    };
  }
  async function set(guildId, payload) {
    const body = {
      Channel: Array.isArray(payload?.Channel) ? payload.Channel.map(String) : undefined,
      User: Array.isArray(payload?.User) ? payload.User.map(String) : undefined,
      Role: Array.isArray(payload?.Role) ? payload.Role.map(String) : undefined,
    };
    await apiRequest(`/v1/leveling/${guildId}/ignores`, { method: "POST", body });
    return true;
  }
  return { get, set };
}

module.exports = LevelingIgnoresService;

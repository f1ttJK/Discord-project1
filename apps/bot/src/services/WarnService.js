"use strict";

const { apiRequest } = require("./ApiClient");

function WarnService() {
  // Warn events
  async function list(guildId, userId) {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await apiRequest(`/v1/guilds/${guildId}/warns${q}`);
    return Array.isArray(res.warns) ? res.warns : [];
  }
  async function create(guildId, payload) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warns`, {
      method: "POST",
      body: payload,
    });
    return res.warn;
  }
  async function revoke(guildId, id, payload) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warns/${id}/revoke`, {
      method: "POST",
      body: payload,
    });
    return res.warn;
  }

  // Warn settings
  async function getSettings(guildId) {
    const res = await apiRequest(`/v1/guilds/${guildId}/settings/warns`);
    return res.settings || null;
  }
  async function setSettings(guildId, settings) {
    const res = await apiRequest(`/v1/guilds/${guildId}/settings/warns`, {
      method: "PUT",
      body: settings,
    });
    return res.settings;
  }

  // Warn reasons
  async function listReasons(guildId, { q = "", active = true } = {}) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (active != null) query.set("active", String(Boolean(active)));
    const qs = query.toString();
    const res = await apiRequest(`/v1/guilds/${guildId}/warn-reasons${qs ? `?${qs}` : ''}`);
    return Array.isArray(res.reasons) ? res.reasons : [];
  }
  async function createReason(guildId, payload) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warn-reasons`, { method: "POST", body: payload });
    return res.reason;
  }
  async function updateReason(guildId, id, payload) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warn-reasons/${id}`, { method: "PUT", body: payload });
    return res.reason;
  }
  async function removeReason(guildId, id) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warn-reasons/${id}`, { method: "DELETE" });
    return Boolean(res.ok);
  }

  // Warn escalation rules
  async function listEscalations(guildId) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warns/escalation`);
    return Array.isArray(res.rules) ? res.rules : [];
  }
  async function createEscalation(guildId, payload) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warns/escalation`, { method: "POST", body: payload });
    return res.rule;
  }
  async function updateEscalation(guildId, id, payload) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warns/escalation/${id}`, { method: "PUT", body: payload });
    return res.rule;
  }
  async function deleteEscalation(guildId, id) {
    const res = await apiRequest(`/v1/guilds/${guildId}/warns/escalation/${id}`, { method: "DELETE" });
    return Boolean(res.ok);
  }

  return {
    // warns
    list, create, revoke,
    // settings
    getSettings, setSettings,
    // reasons
    listReasons, createReason, updateReason, removeReason,
    // escalation
    listEscalations, createEscalation, updateEscalation, deleteEscalation,
  };
}

module.exports = WarnService;

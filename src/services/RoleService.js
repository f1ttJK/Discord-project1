// RoleService placeholder
// Syncs level roles according to guild config (to be implemented).
// Safe no-op with logging to respect rate limits during initial integration.

async function syncLevelRoles(guild, memberId, newLevel, client) {
  try {
    // TODO: fetch guild-specific leveling role config and compute target roles
    // For now, just log the event in structured form
    client?.logs?.info?.(
      JSON.stringify({
        level: "info",
        ts: new Date().toISOString(),
        operation: "level-up",
        guildId: guild?.id,
        userId: memberId,
        newLevel,
      })
    );
    // No role mutations in the placeholder to avoid REST calls until config exists
  } catch (e) {
    client?.logs?.error?.(`RoleService.syncLevelRoles error: ${e.message}`);
  }
}

module.exports = {
  syncLevelRoles,
};

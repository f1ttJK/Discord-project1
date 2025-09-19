"use strict";

const GuildConfigService = require("./GuildConfigService");

/**
 * Bootstrap synchronization with API DB:
 * - ensure all currently joined guilds exist in API DB
 * - prefetch their configs (optional; useful for warm cache/logs)
 */
async function bootstrapApi(client) {
  // Only run when configured to use API DB (service-to-service mode)
  if (process.env.USE_API_DB !== 'true') {
    client.logs.system('ApiBootstrap skipped (USE_API_DB != true)');
    return;
  }

  const svc = GuildConfigService();
  const guilds = client.guilds.cache;
  client.logs.system(`ApiBootstrap: syncing ${guilds.size} guild(s) to API DB...`);

  for (const [guildId, guild] of guilds) {
    try {
      await svc.ensureGuild(guildId);
      // Optionally prefetch config (can be removed if not needed)
      await svc.getConfig(guildId);
    } catch (err) {
      client.logs.warn(`ApiBootstrap: failed for guild ${guildId}: ${err.message}`);
    }
  }

  // Also listen for future joins
  client.on('guildCreate', async (guild) => {
    try {
      await svc.ensureGuild(guild.id);
      await svc.getConfig(guild.id);
      client.logs.system(`ApiBootstrap: ensured guild ${guild.id} after join`);
    } catch (err) {
      client.logs.warn(`ApiBootstrap: failed ensuring guild ${guild.id}: ${err.message}`);
    }
  });
}

module.exports = { bootstrapApi };

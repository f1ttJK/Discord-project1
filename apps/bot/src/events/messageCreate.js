// API-only leveling accrual via REST
const Leveling = require('../services/LevelingService');
const RoleService = require('../services/RoleService');
const { apiRequest } = require('../services/ApiClient');

module.exports = {
  event: 'messageCreate',
  async execute(message, client) {
    try {
      // Defensive guards: null message, bots, DMs, short content
      if (!message || message.author?.bot) return;
      if (!message.inGuild?.() && !message.guild) return;
      if (!message.content || message.content.length < 2) return;

      const inGuild = message.inGuild?.() || !!message.guild;
      const guildId = inGuild ? message.guild.id : null;
      const userId = message.author.id;

      // API-only: forward event to API and exit
      if (!guildId) return;
      try {
        await apiRequest('/v1/leveling/message', {
          method: 'POST',
          body: {
            guildId,
            userId,
            channelId: message.channelId,
            contentLen: message.content?.length ?? 0,
          },
        });
      } catch (e) {
        client.logs?.warn?.(`leveling message API emit failed: ${e.message}`);
      }
      return;
    } catch (e) {
      client.logs?.error?.(`messageCreate earn error: ${e.message}`);
    }
  }
};

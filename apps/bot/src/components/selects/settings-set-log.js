const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:set-log',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: ???????????????????? ???????? ???>?? ?????????????? ??????????????.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const selectedChannelId = interaction.values?.[0];

    if (!selectedChannelId) {
      return interaction.deferUpdate();
    }

    try {
      const WarnService = require('../../services/WarnService');
      const svc = WarnService();
      const current = await svc.getSettings(guildId) || {};
      await svc.setSettings(guildId, { ...current, auditChannelId: selectedChannelId });

      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        const mockInteraction = { ...interaction, values: ['general'] };
        await settingsHandler.execute(mockInteraction, [], client);
      } else {
        await interaction.deferUpdate();
      }

    } catch (error) {
      client.logs.error?.(`Set log channel error: ${error.message}`);
      await interaction.deferUpdate();
    }
  }
};


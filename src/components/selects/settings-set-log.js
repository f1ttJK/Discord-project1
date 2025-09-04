const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:set-log',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const selectedChannelId = interaction.values?.[0];

    if (!selectedChannelId) {
      return interaction.deferUpdate();
    }

    try {
      // Update log channel in warn config
      await client.prisma.warnConfig.upsert({
        where: { guildId },
        update: { logChannelId: selectedChannelId },
        create: { 
          guildId, 
          logChannelId: selectedChannelId 
        }
      });

      // Redirect to main settings handler to rebuild UI
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        // Simulate selecting general option to rebuild the general containers
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
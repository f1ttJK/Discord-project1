const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:set-muteRole',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const selectedRoleId = interaction.values?.[0];

    if (!selectedRoleId) {
      return interaction.deferUpdate();
    }

    try {
      // Update mute role in guild config
      await client.prisma.guild.upsert({
        where: { id: guildId },
        update: { globalMuteRoleId: selectedRoleId },
        create: { 
          id: guildId, 
          globalMuteRoleId: selectedRoleId 
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
      client.logs.error?.(`Set mute role error: ${error.message}`);
      await interaction.deferUpdate();
    }
  }
};
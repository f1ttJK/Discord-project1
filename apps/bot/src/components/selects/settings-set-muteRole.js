const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:set-muteRole',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: ???????????????????? ???????? ???>?? ?????????????? ??????????????.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const selectedRoleId = interaction.values?.[0];

    if (!selectedRoleId) {
      return interaction.deferUpdate();
    }

    try {
      const GuildConfigService = require('../../services/GuildConfigService');
      const cfgSvc = GuildConfigService();
      await cfgSvc.patchConfig(guildId, { muteRole: selectedRoleId });

      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
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


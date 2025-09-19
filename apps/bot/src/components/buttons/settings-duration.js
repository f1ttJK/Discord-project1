const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  customId: 'settings:duration',

  async execute(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'You need the Manage Server permission to adjust warn durations.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      content: 'Warn duration editing is not available in the API-backed mode yet.',
      flags: MessageFlags.Ephemeral,
    });
  },
};

const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-page-prev-disabled',
  
  async execute(interaction, _args, client) {
    // This button is disabled, so this handler should never be called
    // But we provide it for safety
    await interaction.reply({
      content: '   .     .',
      flags: MessageFlags.Ephemeral
    });
  }
};

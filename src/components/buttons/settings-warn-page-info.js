const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-page-info',
  
  async execute(interaction, _args, client) {
    // Placeholder for pagination info (this is typically disabled)
    await interaction.reply({
      content: '📄 Информация о пагинации - эта кнопка предназначена только для отображения.',
      flags: MessageFlags.Ephemeral
    });
  }
};
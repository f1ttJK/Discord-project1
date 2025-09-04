const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-rule-example1',
  
  async execute(interaction, _args, client) {
    // This is an example button - show info message
    await interaction.reply({
      content: '📋 Это пример правила предупреждения. Создайте реальные правила, чтобы настроить их.',
      flags: MessageFlags.Ephemeral
    });
  }
};
const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-delete',
  
  async execute(interaction, args, client) {
    const reasonId = args[0];
    
    // Placeholder for deleting warn rule
    await interaction.reply({
      content: `🗑️ Функция удаления предупреждения (ID: ${reasonId}) находится в разработке.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
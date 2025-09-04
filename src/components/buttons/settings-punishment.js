const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if this is specifically the 'config' action
    if (args[0] === 'config') {
      // Redirect to the punishment config handler
      const punishmentConfigHandler = client.components.get('settings:punishment-config');
      if (punishmentConfigHandler) {
        await punishmentConfigHandler.execute(interaction, [], client);
      } else {
        await interaction.reply({
          content: '⚙️ Конфигурация наказаний в разработке.',
          flags: MessageFlags.Ephemeral
        });
      }
    } else {
      // Default punishment settings action
      await interaction.reply({
        content: '⚙️ Настройки наказаний.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-page-prev',
  
  async execute(interaction, _args, client) {
    // This handler is now deprecated as pagination is handled directly in settings:warn-config
    // Redirect to main warn config with previous page
    const component = client.components.get('settings:warn-config');
    if (component) {
      // Execute main handler with page parameter (will be parsed as page 1 - 1 = 0, clamped to 1)
      await component.execute(interaction, ['page:0'], client);
    } else {
      await interaction.reply({
        content: '❌ Ошибка: не удалось найти обработчик страницы.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
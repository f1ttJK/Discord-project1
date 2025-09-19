const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-page-next',
  
  async execute(interaction, _args, client) {
    // This handler is now deprecated as pagination is handled directly in settings:warn-config
    // Redirect to main warn config with next page
    const component = client.components.get('settings:warn-config');
    if (component) {
      // Execute main handler with page parameter (will be parsed as page 2)
      await component.execute(interaction, ['page:2'], client);
    } else {
      await interaction.reply({
        content: ' :     .',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

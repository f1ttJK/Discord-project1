const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:warn',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check the first argument to determine the action
    if (args[0] === 'config') {
      // Redirect to the warn config handler (warn rules management)
      const warnConfigHandler = client.components.get('settings:warn-config');
      if (warnConfigHandler) {
        await warnConfigHandler.execute(interaction, [], client);
      } else {
        await interaction.reply({
          content: ' :      .',
          flags: MessageFlags.Ephemeral
        });
      }
    } else if (args[0] === 'create' && args[1] === 'rule') {
      // Handle create rule action: settings:warn-create-rule
      const createRuleHandler = client.components.get('settings:warn-create-rule');
      if (createRuleHandler) {
        await createRuleHandler.execute(interaction, [], client);
      } else {
        await interaction.reply({
          content: ' :      .',
          flags: MessageFlags.Ephemeral
        });
      }
    } else if (args[0] === 'edit' && args[1] === 'rule' && args[2]) {
      // Handle edit rule action: settings:warn-edit-rule-{id}
      const reasonId = args[2];
      const editRuleHandler = client.components.get('settings:warn-edit-rule');
      if (editRuleHandler) {
        await editRuleHandler.execute(interaction, [reasonId], client);
      } else {
        await interaction.reply({
          content: ' :      .',
          flags: MessageFlags.Ephemeral
        });
      }
    } else {
      // Default warn settings action - redirect to main settings page
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        // Create a proper mock interaction with all necessary methods
        const mockInteraction = {
          ...interaction,
          values: ['warn'],
          update: interaction.update.bind(interaction),
          reply: interaction.reply.bind(interaction),
          deferUpdate: interaction.deferUpdate ? interaction.deferUpdate.bind(interaction) : undefined
        };
        await settingsHandler.execute(mockInteraction, [], client);
      } else {
        await interaction.reply({
          content: '  .',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};

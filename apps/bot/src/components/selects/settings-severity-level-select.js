const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:severity-level-select',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    const reasonId = args[0];
    const selectedLevel = parseInt(interaction.values?.[0]);

    if (!reasonId || !selectedLevel) {
      return interaction.reply({
        content: ' :    .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    try {
      // Update severity level in database
      await client.prisma.warnReason.update({
        where: { 
          id: parseInt(reasonId),
          guildId: guildId 
        },
        data: { 
          severityLevel: selectedLevel 
        }
      });

      // Redirect back to rule edit page
      const editRuleHandler = client.components.get('settings:warn-edit-rule');
      if (editRuleHandler) {
        await editRuleHandler.execute(interaction, [reasonId], client);
      } else {
        await interaction.reply({
          content: `   : **${selectedLevel}**`,
          flags: MessageFlags.Ephemeral
        });
      }

    } catch (error) {
      client.logs.error?.(`Severity level update error: ${error.message}`);
      await interaction.reply({
        content: '     .',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

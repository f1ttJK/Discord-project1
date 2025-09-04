const { 
  MessageFlags, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-type-select',
  
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const reasonId = args[0];
    const selectedType = interaction.values?.[0];

    if (!reasonId || !selectedType) {
      return interaction.reply({
        content: '❌ Ошибка: не удалось определить параметры.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    try {
      // Update punishment type in database
      const updatedReason = await client.prisma.warnReason.update({
        where: { 
          id: parseInt(reasonId),
          guildId: guildId 
        },
        data: { 
          punishmentType: selectedType 
        }
      });

      // Redirect back to rule edit page
      const editRuleHandler = client.components.get('settings:warn-edit-rule');
      if (editRuleHandler) {
        await editRuleHandler.execute(interaction, [reasonId], client);
      } else {
        await interaction.reply({
          content: `✅ Тип наказания обновлен: **${selectedType}**`,
          flags: MessageFlags.Ephemeral
        });
      }

    } catch (error) {
      client.logs.error?.(`Punishment type update error: ${error.message}`);
      await interaction.reply({
        content: '❌ Ошибка при обновлении типа наказания.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
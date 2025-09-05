const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-set-duration-modal',

  async execute(interaction, args, client) {
    const [messageId, reasonId] = args;
    const guildId = interaction.guildId;

    const minutes = parseInt(interaction.fields.getTextInputValue('duration'), 10);
    if (isNaN(minutes) || minutes <= 0) {
      return interaction.reply({
        content: '❌ Некорректная длительность.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await client.prisma.warnReason.update({
        where: {
          id: parseInt(reasonId),
          guildId
        },
        data: {
          punishmentDurationMin: minutes
        }
      });

      if (messageId) {
        const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
        if (message) {
          const fakeInteraction = { guildId, update: (data) => message.edit(data) };
          const editRule = client.components.get('settings:warn-edit-rule');
          if (editRule) {
            await editRule.execute(fakeInteraction, [reasonId], client);
          }
        }
      }

      await interaction.reply({
        content: '✅ Длительность установлена.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      client.logs.error?.(`Duration set error: ${error.message}`);
      await interaction.reply({
        content: '❌ Ошибка при установке длительности.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};


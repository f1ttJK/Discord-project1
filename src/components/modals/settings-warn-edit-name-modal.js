const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-name-modal',

  async execute(interaction, args, client) {
    const [messageId, reasonId] = args;
    const guildId = interaction.guildId;

    const label = interaction.fields.getTextInputValue('label').trim();
    const description = interaction.fields.getTextInputValue('description').trim();

    if (!label) {
      return interaction.reply({
        content: '❌ Название правила не может быть пустым.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await client.prisma.warnReason.update({
        where: { id: parseInt(reasonId), guildId },
        data: { label, description: description || null }
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
        content: '✅ Правило обновлено.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        return interaction.reply({
          content: '❌ Такое название уже существует.',
          flags: MessageFlags.Ephemeral
        });
      }
      client.logs?.error && client.logs.error(`Warn reason update error: ${error.message}`);
      await interaction.reply({
        content: '❌ Ошибка при обновлении правила.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

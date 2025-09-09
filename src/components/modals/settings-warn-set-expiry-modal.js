const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-set-expiry-modal',

  async execute(interaction, args, client) {
    const [messageId, reasonId] = args;
    const guildId = interaction.guildId;
    const value = parseInt(interaction.fields.getTextInputValue('expiry'), 10);
    const days = isNaN(value) || value <= 0 ? null : value;

    try {
      await client.prisma.warnReason.update({
        where: { id: parseInt(reasonId), guildId },
        data: { expiryDays: days }
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
        content: '✅ Срок действия обновлён.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      client.logs.error?.(`Expiry set error: ${error.message}`);
      await interaction.reply({
        content: '❌ Ошибка при установке срока действия.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};

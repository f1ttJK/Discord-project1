const { MessageFlags } = require('discord.js');

const FIELDS = ['muteThreshold', 'muteDurationMin', 'kickThreshold', 'banThreshold'];

module.exports = {
  customId: 'settings:punishment-set-modal',

  async execute(interaction, args, client) {
    const [messageId, field] = args;
    if (!FIELDS.includes(field)) {
      return interaction.reply({ content: 'Неизвестный параметр.', flags: MessageFlags.Ephemeral });
    }

    const value = parseInt(interaction.fields.getTextInputValue('value'), 10);
    if (isNaN(value) || value <= 0) {
      return interaction.reply({ content: 'Введите положительное число.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const data = {};
    data[field] = value;

    await client.prisma.warnConfig.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data }
    }).catch(() => null);

    if (messageId) {
      const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
      if (message) {
        const fakeInteraction = { guildId, member: interaction.member, update: (d) => message.edit(d) };
        const handler = client.components.get('settings:punishment-config');
        if (handler) {
          await handler.execute(fakeInteraction, [], client);
        }
      }
    }

    await interaction.reply({ content: 'Настройка обновлена.', flags: MessageFlags.Ephemeral });
  }
};

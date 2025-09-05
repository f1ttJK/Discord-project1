const {
  MessageFlags,
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-create-rule-modal',

  async execute(interaction, args, client) {
    const messageId = args[0];
    const label = interaction.fields.getTextInputValue('label').trim();
    const guildId = interaction.guildId;

    if (!label) {
      return interaction.reply({
        content: '❌ Название правила не может быть пустым.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // ensure guild exists for foreign key constraint
      await client.prisma.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId }
      });

      await client.prisma.warnReason.create({
        data: { guildId, label }
      });
    } catch (error) {
      return interaction.reply({
        content: '❌ Не удалось создать правило. Возможно, такое название уже существует.',
        flags: MessageFlags.Ephemeral
      });
    }

    const ITEMS_PER_PAGE = 5;
    const totalItems = await client.prisma.warnReason.count({ where: { guildId } });
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    try {
      const message = await interaction.channel.messages.fetch(messageId);
      const fakeInteraction = {
        guildId,
        update: (data) => message.edit(data)
      };
      await client.components.get('settings:warn-config').execute(fakeInteraction, ['page', totalPages.toString()], client);
    } catch (err) {
      // ignore message update errors
    }

    await interaction.reply({
      content: '✅ Правило создано.',
      flags: MessageFlags.Ephemeral
    });
  }
};

const {
  MessageFlags,
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-create-rule-modal',

  async execute(interaction, args, client) {
    const label = interaction.fields.getTextInputValue('label').trim();
    const guildId = interaction.guildId;

    if (!label) {
      return interaction.reply({
        content: '      .',
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
      if (error?.code === 'P2002') {
        // Unique constraint failed (duplicate label within guild)
        return interaction.reply({
          content: '    .    .',
          flags: MessageFlags.Ephemeral
        });
      }

      // Log unexpected errors for easier debugging
      console.error('Failed to create warn reason:', error);
      return interaction.reply({
        content: '      .',
        flags: MessageFlags.Ephemeral
      });
    }

    const ITEMS_PER_PAGE = 5;
    const totalItems = await client.prisma.warnReason.count({ where: { guildId } });
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    try {
      let targetMessage = interaction.message;
      if (!targetMessage && args[0]) {
        targetMessage = await interaction.channel?.messages.fetch(args[0]).catch(() => null);
      }
      if (targetMessage) {
        const fakeInteraction = {
          guildId,
          update: (data) => targetMessage.edit(data)
        };
        await client.components.get('settings:warn-config').execute(fakeInteraction, ['page', totalPages.toString()], client);
      }
    } catch (err) {
      // ignore message update errors
    }

    await interaction.reply({
      content: '  .',
      flags: MessageFlags.Ephemeral
    });
  }
};


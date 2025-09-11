const {
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-type',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [messageId, warnCountStr] = args;
    const warnCount = parseInt(warnCountStr, 10);
    const selectedType = interaction.values?.[0];

    if (!messageId || !warnCount || !selectedType) {
      return interaction.reply({
        content: '❌ Ошибка: не удалось определить параметры.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    if (selectedType === 'Timeout' || selectedType === 'Mute') {
      const durationSelect = new StringSelectMenuBuilder()
        .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:${selectedType}`)
        .setPlaceholder('Выберите длительность')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('60 сек.').setValue('1'),
          new StringSelectMenuOptionBuilder().setLabel('5 мин.').setValue('5'),
          new StringSelectMenuOptionBuilder().setLabel('1 час.').setValue('60'),
          new StringSelectMenuOptionBuilder().setLabel('1 день').setValue('1440'),
          new StringSelectMenuOptionBuilder().setLabel('1 неделя').setValue('10080')
        );

      return interaction.update({
        content: `Тип наказания: **${selectedType}**\nВыберите длительность:`,
        components: [new ActionRowBuilder().addComponents(durationSelect)]
      });
    }

    try {
      await client.prisma.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId }
      });

      await client.prisma.warnPunishmentRule.create({
        data: {
          guildId,
          warnCount,
          punishmentType: selectedType,
          punishmentDurationMin: null
        }
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        return interaction.update({ content: '❌ Правило с таким количеством предупреждений уже существует.', components: [] });
      }
      return interaction.update({ content: '❌ Ошибка при сохранении правила.', components: [] });
    }

    try {
      let targetMessage = interaction.message;
      if (!targetMessage && messageId) {
        targetMessage = await interaction.channel?.messages.fetch(messageId).catch(() => null);
      }
      if (targetMessage) {
        const fakeInteraction = {
          guildId,
          update: (data) => targetMessage.edit(data)
        };
        await client.components.get('settings:punishment-config').execute(fakeInteraction, [], client);
      }
    } catch (e) {
      // ignore
    }

    return interaction.update({ content: `✅ Правило добавлено: **${selectedType}**`, components: [] });
  }
};

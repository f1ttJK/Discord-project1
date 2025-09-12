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

    // Validate database connection
    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment add type select');
      return interaction.reply({
        content: '❌ Ошибка подключения к базе данных.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [messageId, warnCountStr] = args;
    const warnCount = parseInt(warnCountStr, 10);
    const selectedType = interaction.values?.[0];

    if (!warnCount || !selectedType) {
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

      const actionRow = new ActionRowBuilder().addComponents(durationSelect);

      return interaction.update({
        content: `Количество предупреждений: **${warnCount}**\nТип наказания: **${selectedType}**\nВыберите длительность:`,
        components: [actionRow]
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
      client.logs?.error?.(`Failed to create punishment rule: ${err.message}`);
      if (err?.code === 'P2002') {
        return interaction.update({
          content: '❌ Правило с таким количеством предупреждений уже существует.',
          components: []
        });
      }
      return interaction.update({
        content: '❌ Ошибка при сохранении правила.',
        components: []
      });
    }

    // Rule created successfully - update original settings message
    try {
      if (messageId && messageId !== 'direct') {
        const originalMessage = await interaction.channel?.messages.fetch(messageId).catch(() => null);
        if (originalMessage) {
          const fakeInteraction = {
            guildId,
            update: (data) => originalMessage.edit(data).catch(() => {})
          };
          await client.components.get('settings:punishment-config')?.execute(fakeInteraction, [], client);
        }
      }
    } catch (e) {
      // ignore message update errors
    }

    return interaction.update({
      content: `✅ Правило добавлено: **${selectedType}** для ${warnCount} предупреждений\n\nНастройки обновлены в главном меню.`,
      components: []
    });
  }
};

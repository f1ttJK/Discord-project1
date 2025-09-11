const {
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder
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

      const container = new ContainerBuilder()
        .addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Тип наказания: **${selectedType}**\nВыберите длительность:`)
          )
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(durationSelect)
        );

      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2
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
        const container = new ContainerBuilder().addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('❌ Правило с таким количеством предупреждений уже существует.')
          )
        );
        return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }
      const container = new ContainerBuilder().addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent('❌ Ошибка при сохранении правила.')
        )
      );
      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
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

    const successContainer = new ContainerBuilder().addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`✅ Правило добавлено: **${selectedType}**`)
      )
    );

    return interaction.update({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
  }
};

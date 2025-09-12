const {
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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

    if (selectedType === 'Timeout') {
      const container = new ContainerBuilder()
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Назад')
              .setCustomId('settings:warn-back')
          )
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('> ### Warn |  Наказания')
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel('Создать наказание')
              .setCustomId('settings:punishment-add-rule')
          )
        );

      const typeSelect = new StringSelectMenuBuilder()
        .setCustomId(`settings:punishment-add-type:${messageId}:${warnCount}`)
        .setPlaceholder('Выберите тип наказания')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Timeout').setValue('Timeout'),
          new StringSelectMenuOptionBuilder().setLabel('Mute').setValue('Mute'),
          new StringSelectMenuOptionBuilder().setLabel('Kick').setValue('Kick'),
          new StringSelectMenuOptionBuilder().setLabel('Ban').setValue('Ban'),
          new StringSelectMenuOptionBuilder().setLabel('None').setValue('None')
        );

      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(typeSelect)
      );

      const durationRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('60 сек.')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:1`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('5 мин.')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:5`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('10 мин.')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:10`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('1 час')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:60`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('1 день')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:1440`)
      );

      const durationRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('1 неделя')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:10080`)
      );

      container
        .addActionRowComponents(durationRow1)
        .addActionRowComponents(durationRow2);

      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    if (selectedType === 'Mute') {
      const modal = new ModalBuilder()
        .setCustomId(`settings:punishment-add-mute-modal:${messageId}:${warnCount}`)
        .setTitle('Настройка мута');

      const durationInput = new TextInputBuilder()
        .setCustomId('mute-duration')
        .setLabel('Длительность (мин.)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(durationInput));

      return interaction.showModal(modal);
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
        return interaction.reply({
          content: '❌ Правило с таким количеством предупреждений уже существует.',
          flags: MessageFlags.Ephemeral
        });
      }
      return interaction.reply({
        content: '❌ Ошибка при сохранении правила.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Rule created successfully - show updated rules list
    const config = client.components.get('settings:punishment-config');
    const components = await config.buildComponents(guildId, client);
    await interaction.update({
      components,
      flags: MessageFlags.IsComponentsV2
    });
  }
};

const {
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextDisplayBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-rule-modal',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Validate database connection
    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment add rule modal');
      return interaction.reply({
        content: '❌ Ошибка подключения к базе данных.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [messageId] = args;

    const warnCountStr = interaction.fields.getTextInputValue('warn-count').trim();
    const warnCount = parseInt(warnCountStr, 10);
    if (!Number.isFinite(warnCount) || warnCount <= 0) {
      return interaction.reply({
        content: '❌ Неверное количество предупреждений.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if rule already exists
    try {
      const existingRule = await client.prisma.warnPunishmentRule.findUnique({
        where: {
          guildId_warnCount: {
            guildId: interaction.guildId,
            warnCount: warnCount
          }
        }
      });

      if (existingRule) {
        return interaction.reply({
          content: `❌ Правило для ${warnCount} предупреждений уже существует.`,
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      client.logs?.error?.(`Failed to check existing punishment rule: ${error.message}`);
      // Continue without duplicate check if database query fails
    }

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

    const typeRow = new ActionRowBuilder().addComponents(typeSelect);

    try {
      const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
      if (!message) {
        return interaction.reply({
          content: '❌ Не удалось обновить сообщение.',
          flags: MessageFlags.Ephemeral
        });
      }

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
        )
        .addActionRowComponents(typeRow);

      await message.edit({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.deleteReply().catch(() => {});

      interaction.client.ExpiryMap?.delete(`punishment-add-rule:${messageId}`);
    } catch (error) {
      client.logs?.error?.(`Punishment add rule modal error: ${error.message}`);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Ошибка при обновлении сообщения.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }
  }
};

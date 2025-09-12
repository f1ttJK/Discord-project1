const {
  MessageFlags,
  PermissionFlagsBits,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-config',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Validate database connection
    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment config');
      return interaction.reply({
        content: '❗ Ошибка подключения к базе данных.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const rules = await client.prisma.warnPunishmentRule
      .findMany({ where: { guildId }, orderBy: { warnCount: 'asc' } })
      .catch(() => []);

    const container = new ContainerBuilder();

    if (rules.length === 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Нет настроенных правил.')
      );
    } else {
      for (const rule of rules) {
        const durationText = (rule.punishmentType === 'Timeout' || rule.punishmentType === 'Mute') && rule.punishmentDurationMin
          ? ` (${rule.punishmentDurationMin} мин.)`
          : '';
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`После ${rule.warnCount} предупреждений: ${rule.punishmentType}${durationText}`)
        );
      }
    }

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel('Добавить правило')
          .setCustomId('settings:punishment-add-rule'),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('← Назад')
          .setCustomId('settings:warn-back')
      )
    );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

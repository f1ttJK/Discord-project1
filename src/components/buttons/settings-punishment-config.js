const {
  MessageFlags,
  PermissionFlagsBits,
  ButtonStyle,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ActionRowBuilder
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

    const guildId = interaction.guildId;
    const rules = await client.prisma.warnPunishmentRule.findMany({
      where: { guildId },
      orderBy: { warnCount: 'asc' }
    }).catch(() => []);

    const container = new ContainerBuilder();

    for (const rule of rules) {
      const durationText = (rule.punishmentType === 'Timeout' || rule.punishmentType === 'Mute') && rule.punishmentDurationMin
        ? ` (${rule.punishmentDurationMin} мин.)`
        : '';
      container.addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`После ${rule.warnCount} предупреждений: ${rule.punishmentType}${durationText}`)
        )
      );
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

    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

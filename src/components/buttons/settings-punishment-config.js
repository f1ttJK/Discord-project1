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
    const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null) || {};

    const container = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Изменить')
              .setCustomId('settings:punishment-edit:muteThreshold')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Мут после: ${cfg.muteThreshold ?? 3} предупреждений`)
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Изменить')
              .setCustomId('settings:punishment-edit:muteDurationMin')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Длительность мута: ${cfg.muteDurationMin ?? 60} мин.`)
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Изменить')
              .setCustomId('settings:punishment-edit:kickThreshold')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Кик после: ${cfg.kickThreshold ?? 5} предупреждений`)
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Изменить')
              .setCustomId('settings:punishment-edit:banThreshold')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`Бан после: ${cfg.banThreshold ?? 7} предупреждений`)
          )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
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

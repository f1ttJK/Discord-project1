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

async function buildComponents(guildId, client) {
  const rules = await client.prisma.warnPunishmentRule
    .findMany({ where: { guildId }, orderBy: { warnCount: 'asc' } })
    .catch(() => []);

  const container = new ContainerBuilder();
  // Back button row
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Назад')
        .setCustomId('settings:warn-back')
    )
  );

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('> ### Warn |  Наказания')
  );

  // Create punishment button
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Primary)
        .setLabel('Создать наказание')
        .setCustomId('settings:punishment-add-rule')
    )
  );
  if (rules.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Нет настроенных правил.')
    );
  } else {
    for (const rule of rules) {
      const durationText =
        (rule.punishmentType === 'Timeout' || rule.punishmentType === 'Mute') &&
        rule.punishmentDurationMin
          ? ` (${rule.punishmentDurationMin} мин.)`
          : '';
      container.addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel('🗑')
              .setCustomId(
                `settings:punishment-delete-rule:${rule.warnCount}`
              )
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `После ${rule.warnCount} предупреждений: ${rule.punishmentType}${durationText}`
            )
          )
      );
    }
  }
  return [container];
}

module.exports = {
  customId: 'settings:punishment-config',
  buildComponents,

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment config');
      return interaction.reply({
        content: '❗ Ошибка подключения к базе данных.',
        flags: MessageFlags.Ephemeral
      });
    }
    const components = await buildComponents(interaction.guildId, client);

    await interaction.update({
      components,
      flags: MessageFlags.IsComponentsV2
    });
  }
};

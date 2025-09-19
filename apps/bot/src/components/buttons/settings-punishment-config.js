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
        .setLabel('')
        .setCustomId('settings:warn-back')
    )
  );

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('> ### Warn |  ')
  );

  // Create punishment button
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Primary)
        .setLabel(' ')
        .setCustomId('settings:punishment-add-rule')
    )
  );
  if (rules.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('  .')
    );
  } else {
    for (const rule of rules) {
      const durationText =
        (rule.punishmentType === 'Timeout' || rule.punishmentType === 'Mute') &&
        rule.punishmentDurationMin
          ? ` (${rule.punishmentDurationMin} .)`
          : '';
      container.addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel('')
              .setCustomId(
                `settings:punishment-delete-rule:${rule.warnCount}`
              )
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              ` ${rule.warnCount} : ${rule.punishmentType}${durationText}`
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
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    // API-backed UI for punishments (WarnEscalationRule)
    if (process.env.USE_API_DB === 'true') {
      try {
        const guildId = interaction.guildId;
        const WarnService = require('../../services/WarnService');
        const svc = WarnService();
        const rules = await svc.listEscalations(guildId);

        const components = [];
        const container = new ContainerBuilder();
        // Back button
        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('')
              .setCustomId('settings:warn-back')
          )
        );

        // Header
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('> ### Warn |  ')
        );

        // Create punishment rule
        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel(' ')
              .setCustomId('settings:warn-create-rule')
          )
        );

        if (!rules || rules.length === 0) {
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('  .')
          );
        } else {
          const sorted = [...rules].sort((a,b) => (a.count||0) - (b.count||0));
          for (const r of sorted) {
            const actLabel = (String(r.action) === 'mute' && r.durationMinutes)
              ? 'TIMEOUT'
              : String(r.action || 'none').toUpperCase();
            const dur = r.durationMinutes ? ` (${r.durationMinutes} .)` : '';
            container.addSectionComponents(
              new SectionBuilder()
                .setButtonAccessory(
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel('')
                    .setCustomId(`settings:warn-escalation-menu:${r.id}`)
                )
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    ` ${r.count} : ${actLabel}${dur}`
                  )
                )
            );
          }
        }

        components.push(container);
        return interaction.update({ components, flags: MessageFlags.IsComponentsV2 });
      } catch (e) {
        client.logs?.error?.(`Punishment config (API) error: ${e.message}`);
        return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
      }
    }
    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment config');
      return interaction.reply({
        content: '     .',
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


const { 
  MessageFlags, 
  ButtonStyle, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ContainerBuilder, 
  SectionBuilder, 
  TextDisplayBuilder 
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-rule',

  async execute(interaction, args, client) {
    // The args should contain the reason ID from the parsed customId
    // Format: settings:warn-edit-rule-{reasonId}
    const reasonId = args?.[0] ?? interaction.customId.split('-')[3];
    
    if (!reasonId) {
      return interaction.reply({
        content: ' :    ID .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    // API-backed path: use unified WarnService
    if (process.env.USE_API_DB === 'true') {
      try {
        const WarnService = require('../../services/WarnService');
        const svc = WarnService();
        const rules = await svc.listEscalations(guildId);
        const idNum = Number.parseInt(reasonId, 10);
        const rule = (rules || []).find(r => r.id === idNum);
        if (!rule) {
          return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
        }

        const header = new TextDisplayBuilder().setContent(
          `> ###  \n` +
          `>  - : ${rule.count}\n` +
          `>  : ${String(rule.action).toUpperCase()}\n` +
          `>   (): ${rule.durationMinutes ?? ''}`
        );

        const container = new ContainerBuilder()
          .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(' ').setCustomId('settings:warn-config')
          ))
          .addTextDisplayComponents(header)
          .addActionRowComponents(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('').setCustomId(`settings:warn-escalation-edit:${rule.id}`),
            new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel('').setCustomId(`settings:warn-escalation-delete:${rule.id}`)
          ));

        return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
      } catch (e) {
        client.logs?.error?.(`Warn edit rule (API) error: ${e.message}`);
        return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
      }
    }
    
    // Legacy Prisma path
    const warnReason = await client.prisma.warnReason.findUnique({
      where: { 
        id: parseInt(reasonId),
        guildId: guildId 
      }
    }).catch(() => null);

    if (!warnReason) {
      return interaction.reply({
        content: ' :   .',
        flags: MessageFlags.Ephemeral
      });
    }

    // Build the warn rule edit container
    const warnEditContainer = new ContainerBuilder()
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel(" ")
            .setCustomId("settings:warn-config"),
        ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("")
              .setCustomId(`settings:warn-edit-name-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> ### Warn |  \n` +
              `> [ ${warnReason.label || ' '} ]\n` +
              `> [ ${warnReason.description || ' '} ]`
            ),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("")
              .setCustomId(`settings:warn-edit-punishment-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              ` : ${warnReason.punishmentType || 'None'}`
            ),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("")
              .setCustomId(`settings:warn-edit-duration-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              ` : ${warnReason.punishmentDurationMin ? `${warnReason.punishmentDurationMin} ` : ' '}`
            ),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("")
              .setCustomId(`settings:warn-edit-expiry-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              ` : ${warnReason.expiryDays ? `${warnReason.expiryDays} .` : ' '}`
            ),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel("")
              .setCustomId(`settings:warn-edit-level-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              ` : ${warnReason.severityLevel || ' '}`
            ),
          ),
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel(" ")
              .setCustomId(`settings:warn-delete-${reasonId}`),
          ),
      );

    // Update the interaction with the new container
    await interaction.update({
      components: [warnEditContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

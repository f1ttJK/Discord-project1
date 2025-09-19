"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder } = require("discord.js");

module.exports = {
  customId: "settings:warn-escalation-menu",

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const guildId = interaction.guildId;
    const idRaw = args?.[0] ?? interaction.customId.split(":")[2];
    const id = Number.parseInt(String(idRaw), 10);
    if (!Number.isFinite(id)) {
      return interaction.reply({ content: "   .", flags: MessageFlags.Ephemeral });
    }

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      const rules = await svc.listEscalations(guildId);
      const rule = (rules || []).find(r => r.id === id);
      if (!rule) {
        return interaction.reply({ content: "   .", flags: MessageFlags.Ephemeral });
      }

      const act = (String(rule.action) === 'mute' && rule.durationMinutes)
        ? 'TIMEOUT'
        : String(rule.action || 'none').toUpperCase();
      const dur = rule.durationMinutes ? ` (${rule.durationMinutes} .)` : '';

      const isActive = Object.prototype.hasOwnProperty.call(rule, 'active') ? Boolean(rule.active) : false;
      const container = new ContainerBuilder()
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('')
              .setCustomId('settings:punishment-config'),
          ),
        )
        .addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel('')
                .setCustomId(`settings:warn-escalation-edit:${rule.id}`)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `-  \n>  ${rule.count} : ${act}${dur}`
              ),
            ),
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(isActive ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setLabel(isActive ? '' : '')
              .setCustomId(`settings:warn-escalation-toggle:${rule.id}`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel('')
              .setCustomId(`settings:warn-escalation-delete:${rule.id}`),
          ),
        );

      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (e) {
      client.logs?.error?.(`Warn escalation menu error: ${e.message}`);
      return interaction.reply({ content: "    .", flags: MessageFlags.Ephemeral });
    }
  }
};


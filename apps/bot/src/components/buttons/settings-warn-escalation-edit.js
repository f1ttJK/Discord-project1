"use strict";

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:warn-escalation-edit",

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

      const modal = new ModalBuilder()
        .setCustomId(`settings:warn-escalation-edit-modal:${id}`)
        .setTitle("  ");

      const countInput = new TextInputBuilder()
        .setCustomId("count")
        .setLabel("-  ( 1)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(rule.count));

      // Display 'timeout' in the modal if API stores it as mute with duration
      const displayAction = (String(rule.action) === 'mute' && rule.durationMinutes)
        ? 'timeout'
        : String(rule.action);

      const actionInput = new TextInputBuilder()
        .setCustomId("action")
        .setLabel(" (none|timeout|mute|kick|ban)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(displayAction);

      const durationInput = new TextInputBuilder()
        .setCustomId("durationMinutes")
        .setLabel(" (, )")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(rule.durationMinutes != null ? String(rule.durationMinutes) : "");

      modal.addComponents(
        new ActionRowBuilder().addComponents(countInput),
        new ActionRowBuilder().addComponents(actionInput),
        new ActionRowBuilder().addComponents(durationInput),
      );

      return interaction.showModal(modal);
    } catch (e) {
      client.logs?.error?.(`Warn escalation edit open error: ${e.message}`);
      return interaction.reply({ content: "    .", flags: MessageFlags.Ephemeral });
    }
  }
};


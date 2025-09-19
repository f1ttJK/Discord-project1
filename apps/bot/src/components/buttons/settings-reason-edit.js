"use strict";

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:reason-edit",

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const guildId = interaction.guildId;
    const idRaw = (args && args[0] != null) ? args[0] : interaction.customId.split(":")[2];
    const id = Number.parseInt(String(idRaw), 10);
    if (!Number.isFinite(id)) {
      return interaction.reply({ content: "  ID .", flags: MessageFlags.Ephemeral });
    }

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      const reasons = await svc.listReasons(guildId, { active: false });
      const r = (reasons || []).find(x => x.id === id);
      if (!r) {
        return interaction.reply({ content: "   .", flags: MessageFlags.Ephemeral });
      }

      const modal = new ModalBuilder()
        .setCustomId(`settings:reason-edit-modal:${id}`)
        .setTitle(" ");

      const labelInput = new TextInputBuilder()
        .setCustomId("label")
        .setLabel(" ")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(String(r.label || ""));

      const descInput = new TextInputBuilder()
        .setCustomId("description")
        .setLabel(" ()")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(String(r.description || ""));

      modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(descInput),
      );

      return interaction.showModal(modal);
    } catch (e) {
      if (client.logs && typeof client.logs.error === 'function') {
        client.logs.error(`Reason edit open error: ${e && e.message ? e.message : String(e)}`);
      }
      return interaction.reply({ content: "    .", flags: MessageFlags.Ephemeral });
    }
  }
};


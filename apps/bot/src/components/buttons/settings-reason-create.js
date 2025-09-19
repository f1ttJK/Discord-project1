"use strict";

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
  customId: "settings:reason-create",
  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   */
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(`settings:reason-create-modal:${(interaction.message && interaction.message.id) ? interaction.message.id : '0'}`)
      .setTitle(" ");

    const labelInput = new TextInputBuilder()
      .setCustomId("label")
      .setLabel(" ")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel(" ()")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(labelInput),
      new ActionRowBuilder().addComponents(descInput),
    );

    return interaction.showModal(modal);
  }
};


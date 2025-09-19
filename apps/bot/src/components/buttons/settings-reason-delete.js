"use strict";

const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const generateCode = require("../../utils/generateCode");

module.exports = {
  customId: "settings:reason-delete",

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const idRaw = args?.[0] ?? interaction.customId.split(":")[2];
    const pageArg = args?.[1] ?? interaction.customId.split(":")[4];
    const currentPage = Number.parseInt(String(pageArg || '1'), 10) || 1;
    const id = Number.parseInt(String(idRaw), 10);
    if (!Number.isFinite(id)) {
      return interaction.reply({ content: "  ID .", flags: MessageFlags.Ephemeral });
    }
    // Open confirmation modal with one-time code
    const code = generateCode();
    const modal = new ModalBuilder()
      .setCustomId(`settings:reason-delete-confirm:${id}:p:${currentPage}:code:${code}`)
      .setTitle(' ?');

    const confirmInput = new TextInputBuilder()
      .setCustomId('confirm')
      .setLabel(`  : ${code}`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(confirmInput));
    return interaction.showModal(modal);
  }
};


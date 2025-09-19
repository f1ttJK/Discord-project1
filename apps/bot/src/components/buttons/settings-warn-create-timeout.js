"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, TextDisplayBuilder } = require("discord.js");

module.exports = {
  customId: "settings:warn-create-timeout",

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    // customId: settings:warn-create-timeout:{count}:{minutes}
    const parts = interaction.customId.split(":");
    const count = Number.parseInt(args?.[0] ?? parts[2], 10);
    const minutes = Number.parseInt(args?.[1] ?? parts[3], 10);
    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }

    const options = [5, 10, 60, 1440, 10080];
    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("> ### Warn | \n>    ( 3/3 )")
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(" : ` Timeout `")
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          ...options.map(v => new ButtonBuilder().setStyle(v === minutes ? ButtonStyle.Success : ButtonStyle.Secondary).setLabel(
            v === 5 ? '5 .' : v === 10 ? '10 .' : v === 60 ? '1 ' : v === 1440 ? '1 ' : '1 '
          ).setCustomId(`settings:warn-create-timeout:${count}:${v}`))
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('').setCustomId('settings:punishment-config'),
          new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('').setCustomId(`settings:warn-create-save:count:${count}:action:timeout:duration:${minutes}`),
        )
      );

    return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
};


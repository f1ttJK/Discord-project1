"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");

module.exports = {
  customId: "settings:warn-create-action",

  /**
   * @param {import('discord.js').StringSelectMenuInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const count = Number.parseInt(args?.[0] ?? interaction.customId.split(":")[2], 10);
    const currentAction = interaction.values?.[0] ?? args?.[2] ?? 'none';
    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("> ### Warn | \n>    ( 2/3 )")
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(` : \` ${currentAction === 'none' ? '' : currentAction} \``)
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`settings:warn-create-action:${count}:action:${currentAction}`)
            .setPlaceholder("  ")
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('Mute').setValue('mute').setDefault(currentAction==='mute'),
              new StringSelectMenuOptionBuilder().setLabel('Timeout').setValue('timeout').setDefault(currentAction==='timeout'),
              new StringSelectMenuOptionBuilder().setLabel('Kick').setValue('kick').setDefault(currentAction==='kick'),
              new StringSelectMenuOptionBuilder().setLabel('Ban').setValue('ban').setDefault(currentAction==='ban'),
              new StringSelectMenuOptionBuilder().setLabel('').setValue('none').setDefault(currentAction==='none'),
            )
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('').setCustomId('settings:punishment-config'),
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('').setCustomId(`settings:warn-create-next:count:${count}:action:${currentAction}`),
        )
      );

    return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
};


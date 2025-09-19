"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");

module.exports = {
  customId: "settings:warn-create-count-modal",

  /**
   * @param {import('discord.js').ModalSubmitInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const parts = interaction.customId.split(":");
    const sourceMessageId = parts[2];
    const channelId = parts[4];
    const countRaw = interaction.fields.getTextInputValue('count');
    const count = Number.parseInt(String(countRaw).trim(), 10);
    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: '     (  1).', flags: MessageFlags.Ephemeral });
    }

    // Render Step 2: choose action
    const currentAction = 'none';
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
              new StringSelectMenuOptionBuilder().setLabel('Mute').setValue('mute'),
              new StringSelectMenuOptionBuilder().setLabel('Timeout').setValue('timeout'),
              new StringSelectMenuOptionBuilder().setLabel('Kick').setValue('kick'),
              new StringSelectMenuOptionBuilder().setLabel('Ban').setValue('ban'),
              new StringSelectMenuOptionBuilder().setLabel('').setValue('none').setDefault(true),
            )
        )
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('').setCustomId('settings:punishment-config'),
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('').setCustomId(`settings:warn-create-next:count:${count}:action:${currentAction}`),
        )
      );

    // Respond with the Step 2 UI ephemerally (no attempts to edit original message)
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
};


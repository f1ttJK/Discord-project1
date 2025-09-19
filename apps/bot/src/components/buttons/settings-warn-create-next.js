"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder } = require("discord.js");

module.exports = {
  customId: "settings:warn-create-next",

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    // customId: settings:warn-create-next:count:{count}:action:{action}
    const parts = interaction.customId.split(":");
    const count = Number.parseInt(args?.[1] ?? parts[3], 10);
    const action = (args?.[3] ?? parts[5] ?? 'none').toLowerCase();
    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }

    // If timeout  render step 3 with preset choices
    if (action === 'timeout') {
      const defaultMinutes = 5;
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("> ### Warn | \n>    ( 3/3 )")
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(" : ` Timeout `")
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('5 .').setCustomId(`settings:warn-create-timeout:${count}:5`),
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('10 .').setCustomId(`settings:warn-create-timeout:${count}:10`),
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('1 ').setCustomId(`settings:warn-create-timeout:${count}:60`),
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('1 ').setCustomId(`settings:warn-create-timeout:${count}:1440`),
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('1 ').setCustomId(`settings:warn-create-timeout:${count}:10080`),
          )
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('').setCustomId('settings:punishment-config'),
            new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel('').setCustomId(`settings:warn-create-save:count:${count}:action:timeout:duration:${defaultMinutes}`),
          )
        );

      return interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    if (action === 'mute') {
      // open modal to capture minutes
      const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId(`settings:warn-create-mute-duration:${count}`)
        .setTitle('Mute    ()');
      const input = new TextInputBuilder()
        .setCustomId('minutes')
        .setLabel('   (  1)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // For none/kick/ban  create immediately
    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      await svc.createEscalation(interaction.guildId, { count, action });

      // refresh punishments panel
      let updatedVia = false;
      try {
        const handler = client.components.get('settings:punishment-config');
        if (handler) {
          const fake = { ...interaction, update: async (data) => { updatedVia = true; if (typeof interaction.update === 'function') return interaction.update(data); if (interaction.message?.edit) return interaction.message.edit(data); } };
          await handler.execute(fake, [], client);
        }
      } catch {}

      if (interaction.replied || interaction.deferred || updatedVia) return interaction.followUp({ content: '  .', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '  .', flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`Create escalation (step next) error: ${e.message}`);
      if (interaction.replied || interaction.deferred) return interaction.followUp({ content: '   .', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }
  }
};


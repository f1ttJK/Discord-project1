"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder } = require("discord.js");

module.exports = {
  customId: "settings:warn-create-mute-duration",

  /**
   * @param {import('discord.js').ModalSubmitInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    // customId: settings:warn-create-mute-duration:{count}
    const parts = interaction.customId.split(":");
    const count = Number.parseInt(args?.[0] ?? parts[2], 10);
    const minutesRaw = interaction.fields.getTextInputValue('minutes');
    const minutes = Number.parseInt(String(minutesRaw).trim(), 10);

    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      return interaction.reply({ content: '      (  1).', flags: MessageFlags.Ephemeral });
    }

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      await svc.createEscalation(interaction.guildId, { count, action: 'mute', durationMinutes: minutes });

      // Refresh punishments panel
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
      client.logs?.error?.(`Create mute rule error: ${e.message}`);
      if (interaction.replied || interaction.deferred) return interaction.followUp({ content: '   .', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }
  }
};


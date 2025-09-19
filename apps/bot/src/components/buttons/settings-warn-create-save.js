"use strict";

const { MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:warn-create-save",

  /**
   * @param {import('discord.js').ButtonInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    // customId: settings:warn-create-save:count:{count}:action:{action}:duration:{minutes}
    const parts = interaction.customId.split(":");
    const count = Number.parseInt(args?.[1] ?? parts[3], 10);
    let action = (args?.[3] ?? parts[5] ?? 'none').toLowerCase();
    const durRaw = args?.[5] ?? parts[7];
    const durationMinutes = durRaw ? Number.parseInt(String(durRaw), 10) : undefined;

    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }
    if (!['none','mute','timeout','kick','ban'].includes(action)) {
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }

    // API schema supports: none | mute | kick | ban. Map 'timeout' -> 'mute'.
    if (action === 'timeout') action = 'mute';

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      await svc.createEscalation(interaction.guildId, { count, action, durationMinutes });

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
      client.logs?.error?.(`Create escalation save error: ${e.message}`);
      if (interaction.replied || interaction.deferred) return interaction.followUp({ content: '   .', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    }
  }
};


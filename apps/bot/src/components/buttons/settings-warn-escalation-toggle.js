"use strict";

const { MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:warn-escalation-toggle",

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

      // If API/model doesn't support active, inform and exit
      if (!Object.prototype.hasOwnProperty.call(rule, 'active')) {
        return interaction.reply({ content: "       .", flags: MessageFlags.Ephemeral });
      }

      await svc.updateEscalation(guildId, id, { active: !Boolean(rule.active) });

      // Refresh the rule menu in place
      try {
        const menuHandler = client.components.get('settings:warn-escalation-menu');
        if (menuHandler) {
          const fake = {
            ...interaction,
            update: async (data) => {
              if (typeof interaction.update === 'function') return interaction.update(data);
              if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
            }
          };
          await menuHandler.execute(fake, [String(id)], client);
        }
      } catch {}

      // No extra messages; UI updated in-place
      return;
    } catch (e) {
      client.logs?.error?.(`Warn escalation toggle error: ${e.message}`);
      const msg = "     .";
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }
};


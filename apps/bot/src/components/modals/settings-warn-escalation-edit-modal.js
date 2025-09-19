"use strict";

const { MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:warn-escalation-edit-modal",

  /**
   * @param {import('discord.js').ModalSubmitInteraction} interaction
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

    const countRaw = interaction.fields.getTextInputValue("count");
    const actionRaw = interaction.fields.getTextInputValue("action");
    const durationRaw = interaction.fields.getTextInputValue("durationMinutes");

    const count = Number.parseInt(String(countRaw).trim(), 10);
    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: "     (  1).", flags: MessageFlags.Ephemeral });
    }
    let action = String(actionRaw).trim().toLowerCase();
    const allowed = new Set(["none", "timeout", "mute", "kick", "ban"]);
    if (!allowed.has(action)) {
      return interaction.reply({ content: "     : none, timeout, mute, kick, ban.", flags: MessageFlags.Ephemeral });
    }
    let durationMinutes = undefined;
    if (durationRaw && String(durationRaw).trim().length > 0) {
      const d = Number.parseInt(String(durationRaw).trim(), 10);
      if (!Number.isFinite(d) || d < 1) {
        return interaction.reply({ content: "        1   .", flags: MessageFlags.Ephemeral });
      }
      durationMinutes = d;
    }

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      // Map 'timeout' -> API 'mute' with required duration
      if (action === 'timeout') {
        if (!Number.isFinite(durationMinutes)) {
          return interaction.reply({ content: "  timeout      (  1).", flags: MessageFlags.Ephemeral });
        }
        action = 'mute';
      }
      await svc.updateEscalation(guildId, id, { count, action, durationMinutes });

      // Rebuild the warn rules page (open page where this rule would appear)
      try {
        const rules = await svc.listEscalations(guildId);
        const ITEMS_PER_PAGE = 5;
        const totalItems = Array.isArray(rules) ? rules.length : 0;
        const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

        const settingsHandler = client.components.get('settings:warn-config');
        if (settingsHandler) {
          const fake = {
            ...interaction,
            update: async (data) => {
              if (typeof interaction.update === 'function') return interaction.update(data);
              if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
            }
          };
          await settingsHandler.execute(fake, ['page', String(totalPages)], client);
        }
      } catch (e) {
        client.logs?.warn?.(`Warn escalation refresh failed: ${e.message}`);
      }

      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: "  .", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: "  .", flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`Warn escalation update error: ${e.message}`);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: "    .", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: "    .", flags: MessageFlags.Ephemeral });
    }
  }
};


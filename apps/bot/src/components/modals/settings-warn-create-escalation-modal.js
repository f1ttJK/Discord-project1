"use strict";

const { MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:warn-create-escalation-modal",

  async execute(interaction, args, client) {
    const guildId = interaction.guildId;
    const countRaw = interaction.fields.getTextInputValue("count");
    const actionRaw = interaction.fields.getTextInputValue("action");
    const durationRaw = interaction.fields.getTextInputValue("durationMinutes");

    // Basic validation
    const count = Number.parseInt(String(countRaw).trim(), 10);
    if (!Number.isFinite(count) || count < 1) {
      return interaction.reply({ content: "     (  1).", flags: MessageFlags.Ephemeral });
    }
    const action = String(actionRaw).trim().toLowerCase();
    const allowed = new Set(["none", "mute", "kick", "ban"]);
    if (!allowed.has(action)) {
      return interaction.reply({ content: "     : none, mute, kick, ban.", flags: MessageFlags.Ephemeral });
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
      await svc.createEscalation(guildId, { count, action, durationMinutes });

      // Refresh warn rules view: compute last page after create
      let updatedVia = false;
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
              updatedVia = true;
              if (typeof interaction.update === 'function') return interaction.update(data);
              if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
            }
          };
          await settingsHandler.execute(fake, ['page', String(totalPages)], client);
        } else {
          // Fallback: rebuild main settings to warn tab
          const settingsSelect = client.components.get('settings:select');
          if (settingsSelect) {
            const fake2 = {
              ...interaction,
              values: ['warn'],
              update: async (data) => {
                updatedVia = true;
                if (typeof interaction.update === 'function') return interaction.update(data);
                if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
              }
            };
            await settingsSelect.execute(fake2, [], client);
          }
        }
      } catch (e) {
        client.logs?.warn?.(`Warn escalation refresh failed: ${e.message}`);
      }

      if (interaction.replied || interaction.deferred || updatedVia) {
        return interaction.followUp({ content: "   .", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: "   .", flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`Create warn escalation rule error: ${e.message}`);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: "    .", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: "    .", flags: MessageFlags.Ephemeral });
    }
  }
};


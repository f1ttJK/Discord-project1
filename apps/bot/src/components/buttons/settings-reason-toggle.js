"use strict";

const { MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:reason-toggle",

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
      return interaction.reply({ content: 'Некорректный ID.', flags: MessageFlags.Ephemeral });
    }

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      // fetch list and find target reason
      const reasons = await svc.listReasons(guildId, { active: false });
      const target = (reasons || []).find(r => r.id === id);
      if (!target) {
        return interaction.reply({ content: 'Причина не найдена.', flags: MessageFlags.Ephemeral });
      }
      const updated = await svc.updateReason(guildId, id, { active: !Boolean(target.active) });

      // Refresh reason menu in-place (do not navigate back)
      let updatedVia = 'none';
      try {
        const menuHandler = client.components.get('settings:reason-menu');
        if (menuHandler) {
          const fake = {
            ...interaction,
            update: async (data) => {
              updatedVia = 'update';
              if (typeof interaction.update === 'function') return interaction.update(data);
              if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
            }
          };
          await menuHandler.execute(fake, [String(id)], client);
        }
      } catch {}

      // No extra messages; UI already updated in-place
      return;
    } catch (e) {
      client.logs?.error?.(`Reason toggle error: ${e.message}`);
      const msg = 'Произошла ошибка при изменении причины.';
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }
};


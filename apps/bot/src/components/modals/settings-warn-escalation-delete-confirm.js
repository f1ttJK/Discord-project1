"use strict";

const { MessageFlags } = require("discord.js");

module.exports = {
  customId: "settings:warn-escalation-delete-confirm",

  /**
   * @param {import('discord.js').ModalSubmitInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const guildId = interaction.guildId;
    const parts = interaction.customId.split(":");
    const idRaw = args?.[0] ?? parts[2];
    const expectedCode = parts[4] || '';
    const id = Number.parseInt(String(idRaw), 10);
    if (!Number.isFinite(id)) {
      return interaction.reply({ content: "   .", flags: MessageFlags.Ephemeral });
    }

    const confirm = String(interaction.fields.getTextInputValue('confirm') || '').trim();
    if (confirm !== expectedCode) {
      return interaction.reply({ content: "   .", flags: MessageFlags.Ephemeral });
    }

    try {
      const WarnService = require("../../services/WarnService");
      const svc = WarnService();
      const ok = await svc.deleteEscalation(guildId, id);
      if (!ok) {
        return interaction.reply({ content: "   .", flags: MessageFlags.Ephemeral });
      }

      // After deletion go back to punishments panel
      try {
        const punishHandler = client.components.get('settings:punishment-config');
        if (punishHandler) {
          const fake = {
            ...interaction,
            update: async (data) => {
              if (typeof interaction.update === 'function') return interaction.update(data);
              if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
            }
          };
          await punishHandler.execute(fake, [], client);
        }
      } catch (e) {
        client.logs?.warn?.(`Punishments refresh failed: ${e.message}`);
      }

      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: '  .', flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: '  .', flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`Warn escalation delete confirm error: ${e.message}`);
      if (interaction.replied || interaction.deferred) return interaction.followUp({ content: '    .', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }
  }
};


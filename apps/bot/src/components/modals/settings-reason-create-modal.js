"use strict";

const { MessageFlags } = require("discord.js");
const WarnService = require("../../services/WarnService");

module.exports = {
  customId: "settings:reason-create-modal",

  /**
   * @param {import('discord.js').ModalSubmitInteraction} interaction
   * @param {string[]} args
   * @param {any} client
   */
  async execute(interaction, args, client) {
    const guildId = interaction.guildId;
    const label = String(interaction.fields.getTextInputValue('label') || '').trim();
    const description = String(interaction.fields.getTextInputValue('description') || '').trim();

    if (!label) {
      return interaction.reply({ content: '      .', flags: MessageFlags.Ephemeral });
    }

    try {
      const svc = WarnService();
      await svc.createReason(guildId, { label, description: description || undefined, active: true });

      // Refresh the reasons panel
      try {
        const settingsHandler = client.components.get('settings:warn-config');
        if (settingsHandler) {
          const fake = {
            ...interaction,
            update: async (data) => {
              if (typeof interaction.update === 'function') return interaction.update(data);
              if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
            }
          };
          await settingsHandler.execute(fake, [], client);
        }
      } catch (e) {
        client.logs?.warn?.(`Reasons refresh failed: ${e.message}`);
      }

      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: '  .', flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: '  .', flags: MessageFlags.Ephemeral });
    } catch (e) {
      if (e?.code === 'API_ERROR' || e?.message?.includes('409')) {
        const msg = '    .';
        if (interaction.replied || interaction.deferred) return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
      client.logs?.error?.(`Create reason error: ${e.message}`);
      if (interaction.replied || interaction.deferred) return interaction.followUp({ content: '    .', flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }
  }
};


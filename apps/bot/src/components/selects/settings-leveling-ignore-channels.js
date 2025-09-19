const { PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const LevelingIgnoresService = require('../../services/LevelingIgnoresService');

module.exports = {
  customId: 'settings:leveling-ignore-channels',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const values = interaction.values || [];

    try {
      // API-only: set Channel ignores via service
      const svc = LevelingIgnoresService();
      await svc.set(guildId, { Channel: Array.isArray(values) ? values.filter(Boolean) : [] });
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        const mock = {
          ...interaction,
          values: ['leveling'],
          update: async (data) => {
            if (typeof interaction.update === 'function') return interaction.update(data);
            if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
          }
        };
        await settingsHandler.execute(mock, [], client);
      } else {
        await interaction.deferUpdate();
      }
    } catch (e) {
      client.logs?.error?.(`Leveling ignore channels error: ${e.message}`);
      await interaction.deferUpdate();
    }
  }
};


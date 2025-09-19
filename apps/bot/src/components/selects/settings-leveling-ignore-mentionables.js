const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const LevelingIgnoresService = require('../../services/LevelingIgnoresService');

module.exports = {
  customId: 'settings:leveling-ignore-mentionables',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const values = interaction.values || [];

    try {
      const guild = interaction.guild ?? client.guilds.cache.get(guildId);
      const rolesCache = guild?.roles?.cache;
      // Partition mentionables: if it's a roleId in cache -> Role, else assume User
      const selectedRoleIds = values.filter(id => rolesCache?.has?.(id));
      const selectedUserIds = values.filter(id => !rolesCache?.has?.(id));

      const svc = LevelingIgnoresService();
      await svc.set(guildId, { User: selectedUserIds, Role: selectedRoleIds });

      // Rebuild panel (safe mock)
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
      client.logs?.error?.(`Leveling ignore mentionables error: ${e.message}`);
      await interaction.deferUpdate();
    }
  }
};


const { PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-ignore-mentionables',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const values = interaction.values || [];

    try {
      if (!client.prisma?.levelingIgnore?.findMany) {
        return interaction.reply({ content: '⚠️ Схема БД не обновлена. Выполните: npx prisma generate && npm run prisma:push', flags: MessageFlags.Ephemeral });
      }

      const guild = interaction.guild ?? client.guilds.cache.get(guildId);
      const rolesCache = guild?.roles?.cache;

      // Partition mentionables: if it's a roleId in cache -> Role, else assume User
      const selectedRoleIds = values.filter(id => rolesCache?.has?.(id));
      const selectedUserIds = values.filter(id => !rolesCache?.has?.(id));

      // Load existing rows for both kinds
      const [existingUsers, existingRoles] = await Promise.all([
        client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'User' } }),
        client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Role' } }),
      ]);

      const userSet = new Set(selectedUserIds);
      const roleSet = new Set(selectedRoleIds);

      // Delete removed users
      const toDeleteUsers = existingUsers.filter(r => !userSet.has(r.targetId));
      if (toDeleteUsers.length) {
        await client.prisma.levelingIgnore.deleteMany({ where: { id: { in: toDeleteUsers.map(r => r.id) }, guildId } });
      }
      // Delete removed roles
      const toDeleteRoles = existingRoles.filter(r => !roleSet.has(r.targetId));
      if (toDeleteRoles.length) {
        await client.prisma.levelingIgnore.deleteMany({ where: { id: { in: toDeleteRoles.map(r => r.id) }, guildId } });
      }

      // Add new users
      for (const id of userSet) {
        if (!existingUsers.some(r => r.targetId === id)) {
          await client.prisma.levelingIgnore.create({ data: { guildId, kind: 'User', targetId: id } });
        }
      }
      // Add new roles
      for (const id of roleSet) {
        if (!existingRoles.some(r => r.targetId === id)) {
          await client.prisma.levelingIgnore.create({ data: { guildId, kind: 'Role', targetId: id } });
        }
      }

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

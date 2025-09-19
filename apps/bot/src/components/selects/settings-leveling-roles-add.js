const { PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-roles-add',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const roleIds = interaction.values || [];

    try {
      if (process.env.USE_API_DB === 'true') {
        // API-backed path: read current settings, update roleRewards, push to API
        const LevelingSettingsService = require('../../services/LevelingSettingsService');
        const svc = LevelingSettingsService();
        const current = await svc.get(guildId) || {};
        const MAX_ROLES = 15;
        const selected = Array.from(new Set(roleIds)).slice(0, MAX_ROLES);
        // Build new roleRewards array preserving order; default minLevel=1 if not present
        const existingMap = new Map((current.roleRewards || []).map(r => [r.roleId, r]));
        const newRewards = selected.map((roleId, index) => {
          const prev = existingMap.get(roleId);
          return { roleId, level: prev?.level ?? prev?.minLevel ?? 1, order: index };
        });
        // Normalize: our API schema expects [{ level, roleId }]
        const normalized = newRewards.map(r => ({ roleId: r.roleId, level: r.level }));
        await svc.set(guildId, { ...current, roleRewards: normalized });

        // Rebuild Leveling UI via settings:select
        const settingsHandler = client.components.get('settings:select');
        if (settingsHandler) {
          const mock = {
            ...interaction,
            values: ['leveling'],
            update: async (data) => {
              if (typeof interaction.update === 'function') return interaction.update(data);
              if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
              return interaction.reply?.({ content: '.', flags: MessageFlags.Ephemeral });
            }
          };
          await settingsHandler.execute(mock, [], client);
        } else {
          await interaction.deferUpdate();
        }
        return;
      }
      // Guard: model may not exist until Prisma schema is pushed
      if (!client.prisma?.levelingRole?.findMany) {
        return interaction.reply({ content: '    . : npx prisma generate && npm run prisma:push', flags: MessageFlags.Ephemeral });
      }

      // Fetch existing roles to maintain order and enforce cap (e.g., 7)
      const existing = await client.prisma.levelingRole.findMany({
        where: { guildId },
        orderBy: { order: 'asc' },
      });

      const MAX_ROLES = 15;
      // Current selection as a set (RoleSelect values are role IDs)
      const selected = Array.from(new Set(roleIds));

      // If nothing selected, remove all configured roles for this guild and rebuild
      if (selected.length === 0) {
        if (existing.length > 0) {
          await client.prisma.levelingRole.deleteMany({ where: { guildId } });
        }
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
        return;
      }

      // 1) Remove roles that are no longer selected
      const toRemove = existing.filter(r => !selected.includes(r.roleId));
      if (toRemove.length) {
        await client.prisma.levelingRole.deleteMany({
          where: { id: { in: toRemove.map(r => r.id) }, guildId },
        });
      }

      // 2) Upsert remaining and new ones with new order constrained by MAX_ROLES
      const finalList = selected.slice(0, MAX_ROLES);
      for (let i = 0; i < finalList.length; i++) {
        const roleId = finalList[i];
        const existingRow = existing.find(r => r.roleId === roleId);
        if (existingRow) {
          if (existingRow.order !== i) {
            await client.prisma.levelingRole.update({ where: { id: existingRow.id }, data: { order: i } });
          }
        } else {
          await client.prisma.levelingRole.create({ data: { guildId, roleId, minLevel: 1, order: i } });
        }
      }

      // Rebuild Leveling UI: forge a select-like interaction with update()
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        const mock = {
          ...interaction,
          values: ['leveling'],
          update: async (data) => {
            if (typeof interaction.update === 'function') return interaction.update(data);
            if (interaction.message && typeof interaction.message.edit === 'function') return interaction.message.edit(data);
            return interaction.reply?.({ content: '.', flags: MessageFlags.Ephemeral });
          }
        };
        await settingsHandler.execute(mock, [], client);
      } else {
        await interaction.deferUpdate();
      }
    } catch (e) {
      client.logs?.error?.(`Leveling roles add error: ${e.message}`);
      await interaction.deferUpdate();
    }
  }
};


const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-set-role-modal',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const [idRaw] = args || [];

    const minLevelRaw = interaction.fields.getTextInputValue('minLevel');
    const minLevel = Number.parseInt(String(minLevelRaw).trim(), 10);
    if (!Number.isFinite(minLevel) || minLevel < 1 || minLevel > 10000) {
      return interaction.reply({ content: '     1   10000.', flags: MessageFlags.Ephemeral });
    }

    try {
      if (process.env.USE_API_DB === 'true') {
        // idRaw is roleId in API mode
        const roleId = String(idRaw);
        const LevelingSettingsService = require('../../services/LevelingSettingsService');
        const svc = LevelingSettingsService();
        const current = await svc.get(guildId) || {};
        const rewards = Array.isArray(current.roleRewards) ? current.roleRewards : [];
        const updated = [];
        let found = false;
        for (const r of rewards) {
          if (r.roleId === roleId) {
            updated.push({ roleId, level: minLevel });
            found = true;
          } else {
            updated.push({ roleId: r.roleId, level: r.level ?? r.minLevel ?? 1 });
          }
        }
        if (!found) {
          updated.push({ roleId, level: minLevel });
        }
        await svc.set(guildId, { ...current, roleRewards: updated });
        return interaction.reply({ content: '    (API).', flags: MessageFlags.Ephemeral });
      }

      // Legacy Prisma path
      const id = Number.parseInt(idRaw, 10);
      if (!Number.isFinite(id)) return interaction.reply({ content: '  ID .', flags: MessageFlags.Ephemeral });
      const exists = await client.prisma.levelingRole.findFirst({ where: { id, guildId } });
      if (!exists) return interaction.reply({ content: '       .', flags: MessageFlags.Ephemeral });
      await client.prisma.levelingRole.update({ where: { id }, data: { minLevel } });
      await interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`Leveling set role modal error: ${e.message}`);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '   .', flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
        }
      } catch {}
    }
  }
};


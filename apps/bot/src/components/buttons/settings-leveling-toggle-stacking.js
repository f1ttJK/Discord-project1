const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-toggle-stacking',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;

    try {
      if (process.env.USE_API_DB === 'true') {
        const LevelingSettingsService = require('../../services/LevelingSettingsService');
        const svc = LevelingSettingsService();
        const current = await svc.get(guildId) || {};
        const isStacking = current?.roleStacking !== false; // default true
        const next = !isStacking;
        await svc.set(guildId, { ...current, roleStacking: next });
      } else {
        // Legacy Prisma path
        const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null);
        const current = cfg?.roleStacking !== false; // default true
        const next = !current;
        await client.prisma.levelConfig.upsert({
          where: { guildId },
          update: { roleStacking: next },
          create: { guildId, roleStacking: next, voiceCooldown: cfg?.voiceCooldown ?? 60 },
        });
      }

      // Rebuild UI by rerouting to settings select with 'leveling'
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        const mock = { ...interaction, values: ['leveling'] };
        await settingsHandler.execute(mock, [], client);
      } else {
        await interaction.deferUpdate();
      }
    } catch (e) {
      client.logs?.error?.(`Leveling toggle stacking error: ${e.message}`);
      await interaction.deferUpdate();
    }
  }
};


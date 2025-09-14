const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-voicecooldown',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;

    // Parse args: op:inc | op:dec
    const getArg = (prefix) => {
      const item = (args || []).find(a => String(a).startsWith(prefix + ':'));
      return item ? String(item).slice(prefix.length + 1) : null;
    };

    const op = getArg('op');
    if (!op) {
      return interaction.deferUpdate();
    }

    try {
      const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null);
      const currentCooldown = cfg?.voiceCooldown ?? 60;

      const STEP = 15; // seconds
      const MIN = 0;
      const MAX = 600; // 10 minutes

      let nextCooldown = currentCooldown;
      if (op === 'inc') nextCooldown = Math.min(currentCooldown + STEP, MAX);
      else if (op === 'dec') nextCooldown = Math.max(currentCooldown - STEP, MIN);

      await client.prisma.levelConfig.upsert({
        where: { guildId },
        update: { voiceCooldown: nextCooldown },
        create: { guildId, voiceCooldown: nextCooldown, roleStacking: cfg?.roleStacking ?? true },
      });

      // Rebuild UI under leveling tab
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        const mock = { ...interaction, values: ['leveling'] };
        await settingsHandler.execute(mock, [], client);
      } else {
        await interaction.deferUpdate();
      }
    } catch (e) {
      client.logs?.error?.(`Leveling voice cooldown update error: ${e.message}`);
      await interaction.deferUpdate();
    }
  }
};

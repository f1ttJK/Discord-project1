const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-toggle-stacking',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;

    try {
      // Read current
      const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null);
      const current = cfg?.roleStacking !== false; // default true
      const next = !current;

      await client.prisma.levelConfig.upsert({
        where: { guildId },
        update: { roleStacking: next },
        create: { guildId, roleStacking: next, voiceCooldown: cfg?.voiceCooldown ?? 60 },
      });

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

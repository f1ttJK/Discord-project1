const { MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-set-voicecooldown-modal',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;

    const raw = interaction.fields.getTextInputValue('cooldown');
    const value = Number.parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(value) || value < 0 || value > 600) {
      return interaction.reply({ content: '    0  600.', flags: MessageFlags.Ephemeral });
    }

    try {
      const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null);
      await client.prisma.levelConfig.upsert({
        where: { guildId },
        update: { voiceCooldown: value },
        create: { guildId, voiceCooldown: value, roleStacking: cfg?.roleStacking ?? true },
      });

      // Rebuild the Leveling settings UI
      const settingsHandler = client.components.get('settings:select');
      if (settingsHandler) {
        const mock = { ...interaction, values: ['leveling'] };
        await settingsHandler.execute(mock, [], client);
      }

      await interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`Leveling set voice cooldown modal error: ${e.message}`);
      await interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }
  }
};


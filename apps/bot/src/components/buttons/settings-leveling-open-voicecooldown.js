const { PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-open-voicecooldown',

  async execute(interaction, _args, client) {
    if (!(interaction.member && interaction.member.permissions && interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null);
    const current = (cfg && cfg.voiceCooldown != null) ? cfg.voiceCooldown : 60;

    const modal = new ModalBuilder()
      .setCustomId('settings:leveling-set-voicecooldown-modal')
      .setTitle('   ()');

    const input = new TextInputBuilder()
      .setCustomId('cooldown')
      .setLabel('   (0..600)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(': 60')
      .setValue(String(current));

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }
};


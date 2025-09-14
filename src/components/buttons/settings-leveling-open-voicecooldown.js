const { PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customId: 'settings:leveling-open-voicecooldown',

  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null);
    const current = cfg?.voiceCooldown ?? 60;

    const modal = new ModalBuilder()
      .setCustomId('settings:leveling-set-voicecooldown-modal')
      .setTitle('Установить кулдаун голоса (сек)');

    const input = new TextInputBuilder()
      .setCustomId('cooldown')
      .setLabel('Кулдаун в секундах (0..600)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Например: 60')
      .setValue(String(current));

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }
};

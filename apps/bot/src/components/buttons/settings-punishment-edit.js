const {
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const LABELS = {
  muteThreshold: '  ()',
  muteDurationMin: '  ()',
  kickThreshold: '  ()',
  banThreshold: '  ()'
};

module.exports = {
  customId: 'settings:punishment-edit',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    const field = args[0];
    if (!LABELS[field]) {
      return interaction.reply({ content: ' .', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId(`settings:punishment-set-modal:${interaction.message.id}:${field}`)
      .setTitle(' ');

    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel(LABELS[field])
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }
};


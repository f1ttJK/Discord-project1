const {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const WarnService = require('../../services/WarnService');

module.exports = {
  customId: 'settings:warn-edit-name',

  async execute(interaction, args, client) {
    const reasonId = args[0];

    if (!reasonId) {
      return interaction.reply({
        content: ' :    ID .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    let warnReason = null;
    try {
      const svc = WarnService();
      const reasons = await svc.listReasons(guildId, { active: false });
      warnReason = reasons.find(r => String(r.id) === String(reasonId)) || null;
    } catch {}

    if (!warnReason) {
      return interaction.reply({
        content: ' :   .',
        flags: MessageFlags.Ephemeral
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`settings:warn-edit-name-modal:${interaction.message?.id || ''}:${reasonId}`)
      .setTitle(' ');

    const nameInput = new TextInputBuilder()
      .setCustomId('label')
      .setLabel('')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(warnReason.label);

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setValue(warnReason.description || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    await interaction.showModal(modal);
  }
};


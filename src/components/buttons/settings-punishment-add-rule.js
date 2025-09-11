const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-rule',

  async execute(interaction) {
    const messageId = interaction.message.id;

    // Cache the interaction token so the modal can update the ephemeral message later
    interaction.client.ExpiryMap.set(
      `punishment-add-rule:${messageId}`,
      { token: interaction.token, applicationId: interaction.applicationId },
      900000 // 15 minutes
    );

    const modal = new ModalBuilder()
      .setCustomId(`settings:punishment-add-rule-modal:${messageId}`)
      .setTitle('Новое наказание');

    const warnCountInput = new TextInputBuilder()
      .setCustomId('warn-count')
      .setLabel('Кол-во предупреждений')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(warnCountInput)
    );

    await interaction.showModal(modal);
  }
};

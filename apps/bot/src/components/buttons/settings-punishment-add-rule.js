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

    // Store the original interaction details for the modal to use
    interaction.client.ExpiryMap?.set(
      `punishment-add-rule:${messageId}`,
      {
        originalInteraction: {
          channelId: interaction.channelId,
          messageId: messageId,
          token: interaction.token,
          applicationId: interaction.applicationId
        }
      },
      900000 // 15 minutes
    );

    const modal = new ModalBuilder()
      .setCustomId(`settings:punishment-add-rule-modal:${messageId}`)
      .setTitle(' ');

    const warnCountInput = new TextInputBuilder()
      .setCustomId('warn-count')
      .setLabel('- ')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(': 3');

    modal.addComponents(
      new ActionRowBuilder().addComponents(warnCountInput)
    );

    await interaction.showModal(modal);
  }
};


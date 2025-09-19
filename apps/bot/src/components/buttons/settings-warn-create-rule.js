const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-create-rule',
  
  async execute(interaction) {
    if (process.env.USE_API_DB === 'true') {
      const srcMsgId = interaction.message?.id ?? '0';
      const srcChId = interaction.channelId ?? '0';
      const modal = new ModalBuilder()
        .setCustomId(`settings:warn-create-count-modal:${srcMsgId}:ch:${srcChId}`)
        .setTitle('    1/3');

      const countInput = new TextInputBuilder()
        .setCustomId('count')
        .setLabel('-  (  1)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(countInput),
      );
      return interaction.showModal(modal);
    }

    const modal = new ModalBuilder()
      .setCustomId(`settings:warn-create-rule-modal:${interaction.message.id}`)
      .setTitle(' ');

    const nameInput = new TextInputBuilder()
      .setCustomId('label')
      .setLabel(' ')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
    );

    await interaction.showModal(modal);
  }
};


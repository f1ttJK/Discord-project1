const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-create-rule',
  
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(`settings:warn-create-rule-modal:${interaction.message.id}`)
      .setTitle('Создать правило');

    const nameInput = new TextInputBuilder()
      .setCustomId('label')
      .setLabel('Название правила')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
    );

    await interaction.showModal(modal);
  }
};

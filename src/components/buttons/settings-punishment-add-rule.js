const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-rule',

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(`settings:punishment-add-rule-modal:${interaction.message.id}`)
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

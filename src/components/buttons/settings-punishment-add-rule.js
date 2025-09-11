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

    const typeInput = new TextInputBuilder()
      .setCustomId('type')
      .setLabel('Тип (Timeout/Kick/Ban/Mute)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Длительность (мин, для Timeout/Mute)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(warnCountInput),
      new ActionRowBuilder().addComponents(typeInput),
      new ActionRowBuilder().addComponents(durationInput)
    );

    await interaction.showModal(modal);
  }
};

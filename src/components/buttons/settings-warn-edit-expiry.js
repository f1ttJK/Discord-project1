const {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-expiry',

  async execute(interaction, args, client) {
    const reasonId = args[0];
    if (!reasonId) {
      return interaction.reply({
        content: '❌ Ошибка: не удалось определить ID правила.',
        flags: MessageFlags.Ephemeral
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`settings:warn-set-expiry-modal:${interaction.message.id}:${reasonId}`)
      .setTitle('Установить срок предупреждения');

    const input = new TextInputBuilder()
      .setCustomId('expiry')
      .setLabel('Срок в днях (0 = без срока)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }
};

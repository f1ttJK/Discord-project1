const {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-name',

  async execute(interaction, args, client) {
    const reasonId = args[0];

    if (!reasonId) {
      return interaction.reply({
        content: '❌ Ошибка: не удалось определить ID правила.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const warnReason = await client.prisma.warnReason.findUnique({
      where: {
        id: parseInt(reasonId),
        guildId
      }
    }).catch(() => null);

    if (!warnReason) {
      return interaction.reply({
        content: '❌ Ошибка: правило не найдено.',
        flags: MessageFlags.Ephemeral
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`settings:warn-edit-name-modal:${interaction.message?.id || ''}:${reasonId}`)
      .setTitle('Редактировать предупреждение');

    const nameInput = new TextInputBuilder()
      .setCustomId('label')
      .setLabel('Название')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(warnReason.label);

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Описание')
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

const {
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const LABELS = {
  muteThreshold: 'Количество предупреждений (мут)',
  muteDurationMin: 'Длительность мута (мин)',
  kickThreshold: 'Количество предупреждений (кик)',
  banThreshold: 'Количество предупреждений (бан)'
};

module.exports = {
  customId: 'settings:punishment-edit',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const field = args[0];
    if (!LABELS[field]) {
      return interaction.reply({ content: 'Неизвестный параметр.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId(`settings:punishment-set-modal:${interaction.message.id}:${field}`)
      .setTitle('Изменить значение');

    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel(LABELS[field])
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }
};

const {
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-rule-modal',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'Недостаточно прав для изменения настроек.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const messageId = args[0];

    const warnCountStr = interaction.fields.getTextInputValue('warn-count').trim();
    const warnCount = parseInt(warnCountStr, 10);
    if (!Number.isFinite(warnCount) || warnCount <= 0) {
      return interaction.reply({ content: '❌ Неверное количество предупреждений.', flags: MessageFlags.Ephemeral });
    }

    const typeSelect = new StringSelectMenuBuilder()
      .setCustomId(`settings:punishment-add-type:${messageId}:${warnCount}`)
      .setPlaceholder('Выберите тип наказания')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Timeout').setValue('Timeout'),
        new StringSelectMenuOptionBuilder().setLabel('Mute').setValue('Mute'),
        new StringSelectMenuOptionBuilder().setLabel('Kick').setValue('Kick'),
        new StringSelectMenuOptionBuilder().setLabel('Ban').setValue('Ban')
      );

    return interaction.reply({
      content: 'Выберите тип наказания:',
      components: [new ActionRowBuilder().addComponents(typeSelect)],
      flags: MessageFlags.Ephemeral
    });
  }
};

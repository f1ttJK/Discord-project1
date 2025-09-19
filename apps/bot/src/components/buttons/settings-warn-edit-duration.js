const {
  MessageFlags,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-duration',

  async execute(interaction, args, client) {
    const reasonId = args[0];

    if (!reasonId) {
      return interaction.reply({
        content: ' :    ID .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    const warnReason = await client.prisma.warnReason.findUnique({
      where: {
        id: parseInt(reasonId),
        guildId: guildId
      }
    }).catch(() => null);

    if (!warnReason) {
      return interaction.reply({
        content: ' :   .',
        flags: MessageFlags.Ephemeral
      });
    }

    // Handle mute: open modal to input minutes
    if (warnReason.punishmentType === 'Mute') {
      const modal = new ModalBuilder()
        .setCustomId(`settings:warn-set-duration-modal:${interaction.message.id}:${reasonId}`)
        .setTitle(' ');

      const input = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel(' ()')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    // Handle timeout: show preset buttons
    if (warnReason.punishmentType === 'Timeout') {
      const durationContainer = new ContainerBuilder()
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel(' ')
              .setCustomId(`settings:warn-edit-rule-${reasonId}`)
          )
        )
        .addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel('')
                .setCustomId('noop')
                .setDisabled(true)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                ` : ${warnReason.punishmentDurationMin ? `${warnReason.punishmentDurationMin} ` : ' '}`
              )
            )
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('60 .')
              .setCustomId(`settings:warn-duration-set:${reasonId}:1`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('5 .')
              .setCustomId(`settings:warn-duration-set:${reasonId}:5`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('1 .')
              .setCustomId(`settings:warn-duration-set:${reasonId}:60`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('1 ')
              .setCustomId(`settings:warn-duration-set:${reasonId}:1440`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('1 ')
              .setCustomId(`settings:warn-duration-set:${reasonId}:10080`)
          )
        );

      return interaction.update({
        components: [durationContainer],
        flags: MessageFlags.IsComponentsV2
      });
    }

    return interaction.reply({
      content: '      .',
      flags: MessageFlags.Ephemeral
    });
  }
};



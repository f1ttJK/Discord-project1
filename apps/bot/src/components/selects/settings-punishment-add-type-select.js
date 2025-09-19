const {
  MessageFlags,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

module.exports = {
  customId: 'settings:punishment-add-type',

  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    // Validate database connection
    if (!client?.prisma) {
      client.logs?.error?.('Database client not available in punishment add type select');
      return interaction.reply({
        content: '     .',
        flags: MessageFlags.Ephemeral
      });
    }

    const [messageId, warnCountStr] = args;
    const warnCount = parseInt(warnCountStr, 10);
    const selectedType = interaction.values?.[0];

    if (!warnCount || !selectedType) {
      return interaction.reply({
        content: ' :    .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;

    if (selectedType === 'Timeout') {
      const container = new ContainerBuilder()
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('')
              .setCustomId('settings:warn-back')
          )
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('> ### Warn |  ')
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel(' ')
              .setCustomId('settings:punishment-add-rule')
          )
        );

      const typeSelect = new StringSelectMenuBuilder()
        .setCustomId(`settings:punishment-add-type:${messageId}:${warnCount}`)
        .setPlaceholder('  ')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Timeout').setValue('Timeout'),
          new StringSelectMenuOptionBuilder().setLabel('Mute').setValue('Mute'),
          new StringSelectMenuOptionBuilder().setLabel('Kick').setValue('Kick'),
          new StringSelectMenuOptionBuilder().setLabel('Ban').setValue('Ban'),
          new StringSelectMenuOptionBuilder().setLabel('None').setValue('None')
        );

      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(typeSelect)
      );

      const durationRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('60 .')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:1`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('5 .')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:5`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('10 .')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:10`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('1 ')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:60`),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('1 ')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:1440`)
      );

      const durationRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('1 ')
          .setCustomId(`settings:punishment-add-duration:${messageId}:${warnCount}:Timeout:10080`)
      );

      container
        .addActionRowComponents(durationRow1)
        .addActionRowComponents(durationRow2);

      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    if (selectedType === 'Mute') {
      const modal = new ModalBuilder()
        .setCustomId(`settings:punishment-add-mute-modal:${messageId}:${warnCount}`)
        .setTitle(' ');

      const durationInput = new TextInputBuilder()
        .setCustomId('mute-duration')
        .setLabel(' (.)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(durationInput));

      return interaction.showModal(modal);
    }

    try {
      await client.prisma.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId }
      });

      await client.prisma.warnPunishmentRule.create({
        data: {
          guildId,
          warnCount,
          punishmentType: selectedType,
          punishmentDurationMin: null
        }
      });
    } catch (err) {
      client.logs?.error?.(`Failed to create punishment rule: ${err.message}`);
      if (err?.code === 'P2002') {
        return interaction.reply({
          content: '       .',
          flags: MessageFlags.Ephemeral
        });
      }
      return interaction.reply({
        content: '    .',
        flags: MessageFlags.Ephemeral
      });
    }

    // Rule created successfully - show updated rules list
    const config = client.components.get('settings:punishment-config');
    const components = await config.buildComponents(guildId, client);
    await interaction.update({
      components,
      flags: MessageFlags.IsComponentsV2
    });
  }
};


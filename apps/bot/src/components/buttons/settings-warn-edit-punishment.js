const { 
  MessageFlags, 
  ButtonStyle, 
  ButtonBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-punishment',
  
  async execute(interaction, args, client) {
    const reasonId = args[0];
    
    if (!reasonId) {
      return interaction.reply({
        content: ' :    ID .',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    
    // Get current warn reason from database
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

    // Build punishment type selection interface
    const punishmentContainer = new ContainerBuilder()
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel(" ")
              .setCustomId(`settings:warn-edit-rule-${reasonId}`)
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel("")
              .setCustomId('settings:punishment-type-info')
              .setDisabled(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> ###    "${warnReason.label}"
` +
              `>  : **${warnReason.punishmentType || 'None'}**
` +
              `> 
` +
              `>   :`
            )
          )
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`settings:punishment-type-select-${reasonId}`)
              .setPlaceholder('  ')
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel(' None -  ')
                  .setValue('None')
                  .setDescription(' ,   ')
                  .setDefault(warnReason.punishmentType === 'None' || !warnReason.punishmentType),
                new StringSelectMenuOptionBuilder()
                  .setLabel(' Timeout -  ')
                  .setValue('Timeout')
                  .setDescription('     ')
                  .setDefault(warnReason.punishmentType === 'Timeout'),
                new StringSelectMenuOptionBuilder()
                  .setLabel(' Mute -  ')
                  .setValue('Mute')
                  .setDescription('Временное ограничение через роль (Mute)')
                  .setDefault(warnReason.punishmentType === 'Mute'),
                new StringSelectMenuOptionBuilder()
                  .setLabel(' Kick -  ')
                  .setValue('Kick')
                  .setDescription('     ')
                  .setDefault(warnReason.punishmentType === 'Kick'),
                new StringSelectMenuOptionBuilder()
                  .setLabel(' Ban -  ')
                  .setValue('Ban')
                  .setDescription('    ')
                  .setDefault(warnReason.punishmentType === 'Ban')
              )
          )
      );

    // Update the interaction with punishment type selection
    await interaction.update({
      components: [punishmentContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

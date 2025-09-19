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
  customId: 'settings:warn-edit-level',
  
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

    const currentLevel = warnReason.severityLevel || 1;

    // Build severity level selection interface
    const levelContainer = new ContainerBuilder()
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
              .setCustomId('settings:severity-level-info')
              .setDisabled(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> ###    "${warnReason.label}"
` +
              `>  : **${currentLevel}**
` +
              `>  : **${warnReason.punishmentType || 'None'}**
` +
              `> 
` +
              `>    :`
            )
          )
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`settings:severity-level-select-${reasonId}`)
              .setPlaceholder('  ')
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel('  1 - ')
                  .setValue('1')
                  .setDescription(' ,  ')
                  .setDefault(currentLevel === 1),
                new StringSelectMenuOptionBuilder()
                  .setLabel('  2 - ')
                  .setValue('2')
                  .setDescription(' ,   ')
                  .setDefault(currentLevel === 2),
                new StringSelectMenuOptionBuilder()
                  .setLabel('  3 - ')
                  .setValue('3')
                  .setDescription(' ,   ')
                  .setDefault(currentLevel === 3),
                new StringSelectMenuOptionBuilder()
                  .setLabel('  4 - ')
                  .setValue('4')
                  .setDescription('  ,  ')
                  .setDefault(currentLevel === 4),
                new StringSelectMenuOptionBuilder()
                  .setLabel('  5 - ')
                  .setValue('5')
                  .setDescription(' ,  ')
                  .setDefault(currentLevel === 5)
              )
          )
      );

    // Update the interaction with severity level selection
    await interaction.update({
      components: [levelContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

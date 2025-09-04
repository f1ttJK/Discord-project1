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
        content: '❌ Ошибка: не удалось определить ID правила.',
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
        content: '❌ Ошибка: правило не найдено.',
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
              .setLabel("← Назад")
              .setCustomId(`settings:warn-edit-rule-${reasonId}`)
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel("⚠️")
              .setCustomId('settings:severity-level-info')
              .setDisabled(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> ### Уровень наказания для "${warnReason.label}"
` +
              `> Текущий уровень: **${currentLevel}**
` +
              `> Тип наказания: **${warnReason.punishmentType || 'None'}**
` +
              `> 
` +
              `> Выберите уровень серьёзности нарушения:`
            )
          )
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`settings:severity-level-select-${reasonId}`)
              .setPlaceholder('Выберите уровень серьёзности')
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel('🟢 Уровень 1 - Минимальное')
                  .setValue('1')
                  .setDescription('Лёгкое нарушение, первое предупреждение')
                  .setDefault(currentLevel === 1),
                new StringSelectMenuOptionBuilder()
                  .setLabel('🟡 Уровень 2 - Среднее')
                  .setValue('2')
                  .setDescription('Умеренное нарушение, может потребовать наказания')
                  .setDefault(currentLevel === 2),
                new StringSelectMenuOptionBuilder()
                  .setLabel('🔴 Уровень 3 - Высокое')
                  .setValue('3')
                  .setDescription('Серьёзное нарушение, требует немедленного действия')
                  .setDefault(currentLevel === 3),
                new StringSelectMenuOptionBuilder()
                  .setLabel('⚫ Уровень 4 - Критическое')
                  .setValue('4')
                  .setDescription('Крайне серьёзное нарушение, максимальное наказание')
                  .setDefault(currentLevel === 4),
                new StringSelectMenuOptionBuilder()
                  .setLabel('🔥 Уровень 5 - Экстремальное')
                  .setValue('5')
                  .setDescription('Недопустимое нарушение, мгновенный бан')
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
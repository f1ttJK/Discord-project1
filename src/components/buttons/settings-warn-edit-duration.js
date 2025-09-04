const { 
  MessageFlags, 
  ButtonStyle, 
  ButtonBuilder,
  ActionRowBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-duration',
  
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

    const currentDuration = warnReason.punishmentDurationMin || 0;
    const durationText = currentDuration > 0 ? `${currentDuration} мин` : 'не установлено';

    // Build duration edit interface
    const durationContainer = new ContainerBuilder()
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
              .setLabel("⏰")
              .setCustomId('settings:duration-info')
              .setDisabled(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> ### Длительность наказания для "${warnReason.label}"
` +
              `> Текущая длительность: **${durationText}**
` +
              `> Тип наказания: **${warnReason.punishmentType || 'None'}**
` +
              `> 
` +
              `> Используйте кнопки для изменения длительности:`
            )
          )
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('➖ 5 мин')
              .setCustomId(`settings:duration-adjust-${reasonId}-dec-5`)
              .setDisabled(currentDuration <= 5),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('➕ 5 мин')
              .setCustomId(`settings:duration-adjust-${reasonId}-inc-5`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('➖ 15 мин')
              .setCustomId(`settings:duration-adjust-${reasonId}-dec-15`)
              .setDisabled(currentDuration <= 15),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('➕ 15 мин')
              .setCustomId(`settings:duration-adjust-${reasonId}-inc-15`)
          )
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('➖ 1 час')
              .setCustomId(`settings:duration-adjust-${reasonId}-dec-60`)
              .setDisabled(currentDuration <= 60),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('➕ 1 час')
              .setCustomId(`settings:duration-adjust-${reasonId}-inc-60`),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel('🗑️ Сбросить')
              .setCustomId(`settings:duration-reset-${reasonId}`)
              .setDisabled(currentDuration === 0)
          )
      );

    // Update the interaction with duration edit interface
    await interaction.update({
      components: [durationContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
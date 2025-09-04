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

    // Build punishment type selection interface
    const punishmentContainer = new ContainerBuilder()
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
              .setLabel("🛡️")
              .setCustomId('settings:punishment-type-info')
              .setDisabled(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> ### Тип наказания для "${warnReason.label}"
` +
              `> Текущий тип: **${warnReason.punishmentType || 'None'}**
` +
              `> 
` +
              `> Выберите тип наказания:`
            )
          )
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`settings:punishment-type-select-${reasonId}`)
              .setPlaceholder('Выберите тип наказания')
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel('🔓 None - Без наказания')
                  .setValue('None')
                  .setDescription('Только предупреждение, без дополнительных действий')
                  .setDefault(warnReason.punishmentType === 'None' || !warnReason.punishmentType),
                new StringSelectMenuOptionBuilder()
                  .setLabel('⏰ Timeout - Временная блокировка')
                  .setValue('Timeout')
                  .setDescription('Временно заблокировать пользователя от отправки сообщений')
                  .setDefault(warnReason.punishmentType === 'Timeout'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('🔇 Mute - Роль мута')
                  .setValue('Mute')
                  .setDescription('Выдать роль мута пользователю')
                  .setDefault(warnReason.punishmentType === 'Mute')
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
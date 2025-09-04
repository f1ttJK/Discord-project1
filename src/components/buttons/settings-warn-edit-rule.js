const { 
  MessageFlags, 
  ButtonStyle, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ContainerBuilder, 
  SectionBuilder, 
  TextDisplayBuilder 
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-edit-rule',
  
  async execute(interaction, args, client) {
    // The args should contain the reason ID from the parsed customId
    // Format: settings:warn-edit-rule-{reasonId}
    const reasonId = args[0]; // This should be the reason ID
    
    if (!reasonId) {
      return interaction.reply({
        content: '❌ Ошибка: не удалось определить ID правила.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    
    // Get the specific warn reason from database
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

    // Build the warn rule edit container
    const warnEditContainer = new ContainerBuilder()
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("Назад")
              .setCustomId("settings:warn-config"),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("✏️")
              .setCustomId(`settings:warn-edit-name-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> ### Warn |  Предупреждения\n` +
              `> [ ${warnReason.label || 'название предупреждения'} ]\n` +
              `> [ ${warnReason.description || 'описание предупреждения'} ]`
            ),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("⚙️")
              .setCustomId(`settings:warn-edit-punishment-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Тип наказания: ${warnReason.punishmentType || 'None'}`
            ),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("⚙️")
              .setCustomId(`settings:warn-edit-duration-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Длительность предупреждения: ${warnReason.punishmentDurationMin ? `${warnReason.punishmentDurationMin} мин` : 'не установлено'}`
            ),
          ),
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel("⚙️")
              .setCustomId(`settings:warn-edit-level-${reasonId}`)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Уровень наказания: ${warnReason.severityLevel || 'не установлен'}`
            ),
          ),
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel("Удалить предупреждение")
              .setCustomId(`settings:warn-delete-${reasonId}`),
          ),
      );

    // Update the interaction with the new container
    await interaction.update({
      components: [warnEditContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
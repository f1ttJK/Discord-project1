const { 
  ButtonStyle, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ContainerBuilder, 
  SectionBuilder, 
  TextDisplayBuilder,
  MessageFlags 
} = require('discord.js');

module.exports = {
  customId: 'settings:warn-config',
  
  async execute(interaction, args, client) {
    const guildId = interaction.guildId;
    
    // Parse page number from args (format: settings:warn-config:page:2)
    let requestedPage = 1;
    const pageIndex = args.indexOf('page');
    if (pageIndex !== -1) {
      const parsed = parseInt(args[pageIndex + 1]);
      if (!isNaN(parsed)) requestedPage = parsed;
    }
    
    // Get warn reasons from database
    const warnReasons = await client.prisma.warnReason.findMany({
      where: { guildId },
      orderBy: { id: 'asc' }
    }).catch(() => []);

    // Pagination settings
    const ITEMS_PER_PAGE = 5; // Maximum sections that can fit in a Discord message
    const totalItems = warnReasons.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const currentPage = Math.max(1, Math.min(requestedPage, totalPages)); // Clamp page number
    
    // Calculate items for current page
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    const pageItems = warnReasons.slice(startIndex, endIndex);

    // Build the warn rules management container
    const warnRulesContainer = new ContainerBuilder()
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("← Back")
              .setCustomId("settings:warn-back"),
          ),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("> ### Warn |  Предупреждения"),
      )
      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel("Создать Правило")
              .setCustomId("settings:warn-create-rule"),
          ),
      );

    // If no rules exist, show placeholder text
    if (totalItems === 0) {
      warnRulesContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Правил нет. Создайте правило, чтобы начать."),
      );
    } else {
      // Show existing rules for current page
      pageItems.forEach(reason => {
        const statusIcon = reason.active ? '🟢' : '🔴';
        const punishmentType = reason.punishmentType || 'None';
        const duration = reason.punishmentDurationMin ? ` (${reason.punishmentDurationMin} мин)` : '';
        
        warnRulesContainer.addSectionComponents(
          new SectionBuilder()
            .setButtonAccessory(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setLabel("⚙️")
                .setCustomId(`settings:warn-edit-rule-${reason.id}`)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `\`${statusIcon}\` | ${reason.label}\n` +
                `Тип наказания: ( ${punishmentType}${duration} )\n` +
                `Срок: ${reason.expiryDays ? `${reason.expiryDays} д.` : '∞'}\n` +
                `Уровень наказания: ${reason.punishmentType !== 'None' ? '⚠️' : ''}`
              ),
            ),
        );
      });
    }

    // Add pagination controls with real page numbers
    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= totalPages;
    const pageInfo = totalItems === 0 ? "0 | 0" : `${currentPage} | ${totalPages}`;
    
    const prevPage = Math.max(1, currentPage - 1);
    const nextPage = Math.min(totalPages, currentPage + 1);
    
    // Ensure unique customIds for pagination buttons
    const prevCustomId = prevDisabled ? "settings:warn-page-prev-disabled" : `settings:warn-config:page:${prevPage}`;
    const nextCustomId = nextDisabled ? "settings:warn-page-next-disabled" : `settings:warn-config:page:${nextPage}`;
    
    warnRulesContainer.addActionRowComponents(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Назад")
            .setCustomId(prevCustomId)
            .setDisabled(prevDisabled),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel(pageInfo)
            .setDisabled(true)
            .setCustomId("settings:warn-page-info"),
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel("Вперед")
            .setCustomId(nextCustomId)
            .setDisabled(nextDisabled),
        ),
    );

    // Update the interaction with the new container
    await interaction.update({
      components: [warnRulesContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
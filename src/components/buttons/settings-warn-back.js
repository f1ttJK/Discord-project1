const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'settings:warn-back',
  
  async execute(interaction, _args, client) {
    // Get the base container (dropdown menu)
    const SELECT_ID = 'settings:select';
    const OPTION_WARN = 'warn';
    const REFRESH_BUTTON_ID = 'settings:refresh';
    
    const { 
      StringSelectMenuBuilder,
      StringSelectMenuOptionBuilder,
      ButtonBuilder,
      ContainerBuilder,
      ButtonStyle
    } = require('discord.js');

    const baseContainer = new ContainerBuilder()
      .addActionRowComponents(row => row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId(SELECT_ID)
          .setPlaceholder('🛠️ Выберите категорию настроек')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('⚠️ Предупреждения')
              .setValue(OPTION_WARN)
              .setDescription('Настройка системы предупреждений'),
            new StringSelectMenuOptionBuilder()
              .setLabel('🔇 Мут')
              .setValue('mute')
              .setDescription('Настройка системы мутов'),
            new StringSelectMenuOptionBuilder()
              .setLabel('💰 Экономика')
              .setValue('economy')
              .setDescription('Настройка экономической системы'),
            new StringSelectMenuOptionBuilder()
              .setLabel('⚙️ Общие')
              .setValue('general')
              .setDescription('Общие настройки сервера')
          )
      ))
      .addActionRowComponents(row => row.setComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('🔄 Обновить')
          .setCustomId(REFRESH_BUTTON_ID)
      ));

    // Get warn containers
    const guildId = interaction.guildId;
    const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
    const isEnabled = cfg?.enabled !== false;

    const { SectionBuilder, TextDisplayBuilder } = require('discord.js');

    const warnPageContainer = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
              .setLabel(isEnabled ? 'Enabled' : 'Disabled')
              .setCustomId('settings:toggle-warn-from:warn')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('> ### Warn')
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('⚙️')
              .setCustomId('settings:warn-config')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              '> ### Предупреждения\n' +
              'Настройка предупреждений'
            )
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('⚙️')
              .setCustomId('settings:punishment-config')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              '> ### Наказания\n' +
              'Настройка наказаний за предупреждения.'
            )
          )
      )
      // ... rest of warn configuration sections with statistics and buttons
      ;

    // Return to the main warn settings page
    await interaction.update({
      components: [baseContainer, warnPageContainer],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
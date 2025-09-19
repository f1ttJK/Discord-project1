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
          .setPlaceholder('   ')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(' ')
              .setValue(OPTION_WARN)
              .setDescription('  '),
            new StringSelectMenuOptionBuilder()
              .setLabel(' ')
              .setValue('mute')
              .setDescription('  '),
            new StringSelectMenuOptionBuilder()
              .setLabel(' ')
              .setValue('economy')
              .setDescription('  '),
            new StringSelectMenuOptionBuilder()
              .setLabel(' ')
              .setValue('general')
              .setDescription('  ')
          )
      ))
      .addActionRowComponents(row => row.setComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel(' ')
          .setCustomId(REFRESH_BUTTON_ID)
      ));

    // Get warn containers
    const guildId = interaction.guildId;
    let isEnabled = true;
    if (process.env.USE_API_DB === 'true') {
      try {
        const WarnService = require('../../services/WarnService');
        const svc = WarnService();
        const s = await svc.getSettings(guildId);
        isEnabled = s?.enabled !== false;
      } catch {
        isEnabled = true;
      }
    } else {
      const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
      isEnabled = cfg?.enabled !== false;
    }

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
              .setLabel('')
              .setCustomId('settings:warn-config')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              '> ### \n' +
              ' '
            )
          )
      )
      .addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel('')
              .setCustomId('settings:punishment-config')
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              '> ### \n' +
              '   .'
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

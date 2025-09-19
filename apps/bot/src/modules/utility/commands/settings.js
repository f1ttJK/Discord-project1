const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
} = require('discord.js');

// Component IDs
const SELECT_ID = 'settings:select';
const OPTION_WARN = 'warn';
const OPTION_MUTE = 'mute';
const OPTION_ECONOMY = 'economy';
const OPTION_GENERAL = 'general';
const REFRESH_BUTTON_ID = 'settings:refresh';

function buildBaseContainer() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder('   ')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_WARN)
        .setDescription('Настройки предупреждений'),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_MUTE)
        .setDescription('Настройки мута'),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_ECONOMY)
        .setDescription('Экономика сервера'),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue('leveling')
        .setDescription('Прокачка (уровни)'),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_GENERAL)
        .setDescription('Общие настройки')
    );

  const refreshBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel(' ')
    .setCustomId(REFRESH_BUTTON_ID);

  return new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(select))
    .addActionRowComponents(row => row.setComponents(refreshBtn));
}

function buildWelcomeSection() {
  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel(' ')
            .setCustomId('settings:info')
            .setDisabled(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '> ###    \n' +
            '>        .\n' +
            '> \n' +
            '> ** :**\n' +
            '>   **** -   \n' +
            '>   **** -   \n' +
            '>   **** -   \n' +
            '>   **** -   \n' +
            '>   **** -   \n' +
            '> \n' +
            '> *  *'
          )
        )
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Панель настроек бота для сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ManageGuild],

  async execute(interaction) {
    const baseContainer = buildBaseContainer();
    const welcomeSection = buildWelcomeSection();

    await interaction.reply({
      components: [baseContainer, welcomeSection],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};



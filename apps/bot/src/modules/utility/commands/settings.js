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
    .setPlaceholder('Выберите категорию настроек')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Предупреждения')
        .setValue(OPTION_WARN)
        .setDescription('Настройки системы предупреждений'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Муты')
        .setValue(OPTION_MUTE)
        .setDescription('Управление системой мутов'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Экономика')
        .setValue(OPTION_ECONOMY)
        .setDescription('Экономические параметры сервера'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Уровни')
        .setValue('leveling')
        .setDescription('Настройки прокачки и опыта'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Общее')
        .setValue(OPTION_GENERAL)
        .setDescription('Основные параметры бота')
    );

  const refreshBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Обновить')
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
            .setLabel('Добро пожаловать')
            .setCustomId('settings:info')
            .setDisabled(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '> ### Панель настроек\n' +
            '> Используйте меню ниже, чтобы настроить поведение бота.\n' +
            '> \n' +
            '> **Разделы:**\n' +
            '> • Предупреждения — управление системой наказаний.\n' +
            '> • Муты — выбор роли и длительности мута.\n' +
            '> • Экономика — параметры внутриигровых валют.\n' +
            '> • Уровни — конфигурация системы прокачки.\n' +
            '> • Общее — базовые настройки сервера.\n' +
            '> \n' +
            '> *Выберите пункт, чтобы продолжить.*'
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



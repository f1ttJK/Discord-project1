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
    .setPlaceholder('🛠️ Выберите категорию настроек')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('⚠️ Предупреждения')
        .setValue(OPTION_WARN)
        .setDescription('Настройка системы предупреждений'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔇 Мут')
        .setValue(OPTION_MUTE)
        .setDescription('Настройка системы мутов'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💰 Экономика')
        .setValue(OPTION_ECONOMY)
        .setDescription('Настройка экономической системы'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚙️ Общие')
        .setValue(OPTION_GENERAL)
        .setDescription('Общие настройки сервера')
    );

  const refreshBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('🔄 Обновить')
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
            .setLabel('📋 Панель')
            .setCustomId('settings:info')
            .setDisabled(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '> ### 🛠️ Панель управления сервером\n' +
            '> Используйте выпадающее меню выше для выбора категории настроек.\n' +
            '> \n' +
            '> **Доступные категории:**\n' +
            '> • ⚠️ **Предупреждения** - настройка системы варнов\n' +
            '> • 🔇 **Мут** - настройка системы мутов\n' +
            '> • 💰 **Экономика** - настройка экономической системы\n' +
            '> • ⚙️ **Общие** - основные настройки сервера\n' +
            '> \n' +
            '> *Доступно только администраторам*'
          )
        )
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('🛠️ Открыть панель управления сервером')
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


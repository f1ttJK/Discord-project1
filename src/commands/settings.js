const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ContainerBuilder,
} = require('discord.js');

// Component IDs as requested
const SELECT_ID = 'settings:select';
const OPTION_WARN = 'warn';
const OPTION_MUTE = 'mute';
const REFRESH_BUTTON_ID = 'settings:refresh';

function buildBaseContainer() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder('Select a parameter')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Warn').setValue(OPTION_WARN),
      new StringSelectMenuOptionBuilder().setLabel('Mute').setValue(OPTION_MUTE),
    );

  const refreshBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Refresh Menu')
    .setCustomId(REFRESH_BUTTON_ID);

  return new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(select))
    .addActionRowComponents(row => row.setComponents(refreshBtn));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Open settings panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ManageGuild],

  async execute(interaction) {
    const container = buildBaseContainer();

    await interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};


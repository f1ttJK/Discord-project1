const {
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ContainerBuilder,
} = require('discord.js');

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
  customId: REFRESH_BUTTON_ID,
  async execute(interaction) {
    const { PermissionFlagsBits, MessageFlags } = require('discord.js');
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const container = buildBaseContainer();
    await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};



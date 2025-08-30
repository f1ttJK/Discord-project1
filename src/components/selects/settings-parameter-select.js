const {
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
} = require('discord.js');

const SELECT_ID = 'settings:select';
const OPTION_WARN = 'warn';
const OPTION_MUTE = 'mute';
const OPTION_GENERAL = 'general';
const REFRESH_BUTTON_ID = 'settings:refresh';
const TOGGLE_BUTTON_ID = 'settings:toggle';

function buildBaseContainer() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder('Select a parameter')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Warn').setValue(OPTION_WARN),
      new StringSelectMenuOptionBuilder().setLabel('Mute').setValue(OPTION_MUTE),
      new StringSelectMenuOptionBuilder().setLabel('General').setValue(OPTION_GENERAL),
    );

  const refreshBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Refresh Menu')
    .setCustomId(REFRESH_BUTTON_ID);

  return new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(select))
    .addActionRowComponents(row => row.setComponents(refreshBtn));
}

async function buildGeneralContainers(interaction, client) {
  const guildId = interaction.guildId;
  const [cfg, guildRow] = await Promise.all([
    client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null),
    client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null),
  ]);

  const warnEnabled = cfg?.enabled !== false;
  const muteEnabled = guildRow?.muteEnabled !== false;
  const logChannelId = cfg?.logChannelId ?? null;
  const muteRoleId = guildRow?.globalMuteRoleId ?? null;

  const statusText = [
    `> ### General`,
    `- Warn: ${warnEnabled ? 'Enabled' : 'Disabled'}`,
    `- Mute: ${muteEnabled ? 'Enabled' : 'Disabled'}`,
    `- Logs: ${logChannelId ? `<#${logChannelId}>` : 'not set'}`,
    `- Mute Role: ${muteRoleId ? `<@&${muteRoleId}>` : 'not set'}`,
  ].join('\n');

  const header = new ContainerBuilder().addSectionComponents(
    new SectionBuilder()
      .setButtonAccessory(btn => btn
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Info')
        .setCustomId('settings:info-general')
        .setDisabled(true)
      )
      .addTextDisplayComponents(text => text.setContent(statusText))
  );

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('settings:set-log')
    .setPlaceholder('Select log channel')
    .setMaxValues(1)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('settings:set-muteRole')
    .setPlaceholder('Select mute role')
    .setMaxValues(1);

  const toggleWarn = new ButtonBuilder()
    .setStyle(warnEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
    .setLabel(warnEnabled ? 'Warn: Enabled' : 'Warn: Disabled')
    .setCustomId('settings:toggle-warn-from:general');

  const toggleMute = new ButtonBuilder()
    .setStyle(muteEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
    .setLabel(muteEnabled ? 'Mute: Enabled' : 'Mute: Disabled')
    .setCustomId('settings:toggle-mute-from:general');

  const controls = new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(channelSelect))
    .addActionRowComponents(row => row.setComponents(roleSelect))
    .addActionRowComponents(row => row.setComponents(toggleWarn, toggleMute));

  return [header, controls];
}

module.exports = {
  customId: SELECT_ID,
  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const value = interaction.values?.[0];

    const baseContainer = buildBaseContainer();
    let containers = [baseContainer];

    if (value === OPTION_WARN) {
      const guildId = interaction.guildId;
      const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
      const isEnabled = cfg?.enabled !== false;
      const section = new SectionBuilder()
        .setButtonAccessory(btn => btn
          .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
          .setLabel(isEnabled ? 'Enabled' : 'Disabled')
          .setCustomId(`${TOGGLE_BUTTON_ID}-warn-from:warn`)
        )
        .addTextDisplayComponents(text => text.setContent('> ### Warn'));
      containers.push(new ContainerBuilder().addSectionComponents(section));

      const cfgText = [
        `- Mute Threshold: ${cfg?.muteThreshold ?? 3}`,
        `- Kick Threshold: ${cfg?.kickThreshold ?? 5}`,
        `- Ban Threshold: ${cfg?.banThreshold ?? 7}`,
        `- Mute Duration (min): ${cfg?.muteDurationMin ?? 60}`,
        `- Warn Expiry (days): ${cfg?.expiryDays ?? 'none'}`,
      ].join('\n');
      containers.push(new ContainerBuilder().addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(btn => btn
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Info')
            .setCustomId('settings:info-warn')
            .setDisabled(true)
          )
          .addTextDisplayComponents(text => text.setContent(cfgText))
      ));

      containers.push(
        new ContainerBuilder()
          .addActionRowComponents(row => row.setComponents(
            new ButtonBuilder().setCustomId('settings:warnedit-field:muteThreshold-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- MuteT'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:muteThreshold-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ MuteT'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:kickThreshold-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- KickT'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:kickThreshold-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ KickT'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:banThreshold-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- BanT'),
          ))
          .addActionRowComponents(row => row.setComponents(
            new ButtonBuilder().setCustomId('settings:warnedit-field:banThreshold-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ BanT'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- Duration'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ Duration'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:expiryDays-op:dec-from:warn').setStyle(ButtonStyle.Secondary).setLabel('- Expiry'),
            new ButtonBuilder().setCustomId('settings:warnedit-field:expiryDays-op:inc-from:warn').setStyle(ButtonStyle.Secondary).setLabel('+ Expiry'),
          ))
      );
    } else if (value === OPTION_MUTE) {
      const guildId = interaction.guildId;
      const guildRow = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
      const isEnabled = guildRow?.muteEnabled !== false;
      const section = new SectionBuilder()
        .setButtonAccessory(btn => btn
          .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
          .setLabel(isEnabled ? 'Enabled' : 'Disabled')
          .setCustomId(`${TOGGLE_BUTTON_ID}-mute-from:mute`)
        )
        .addTextDisplayComponents(text => text.setContent('> ### Mute'));
      containers.push(new ContainerBuilder().addSectionComponents(section));

      const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
      const cfgText = [
        `- Mute Duration (min): ${cfg?.muteDurationMin ?? 60}`,
      ].join('\n');
      containers.push(new ContainerBuilder().addSectionComponents(
        new SectionBuilder()
          .setButtonAccessory(btn => btn
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Info')
            .setCustomId('settings:info-mute')
            .setDisabled(true)
          )
          .addTextDisplayComponents(text => text.setContent(cfgText))
      ));
      containers.push(new ContainerBuilder().addActionRowComponents(row => row.setComponents(
        new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:dec-from:mute').setStyle(ButtonStyle.Secondary).setLabel('- Duration'),
        new ButtonBuilder().setCustomId('settings:warnedit-field:muteDurationMin-op:inc-from:mute').setStyle(ButtonStyle.Secondary).setLabel('+ Duration'),
      )));
    } else if (value === OPTION_GENERAL) {
      const generalContainers = await buildGeneralContainers(interaction, client);
      containers = [baseContainer, ...generalContainers];
    }

    await interaction.update({ components: containers, flags: MessageFlags.IsComponentsV2 });
  },
};

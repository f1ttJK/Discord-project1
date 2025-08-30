const {
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
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
    new SectionBuilder().addTextDisplayComponents(text => text.setContent(statusText)),
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
  customId: 'settings:toggle',
  async execute(interaction, args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Недостаточно прав для изменения настроек.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    const guildId = interaction.guildId;
    const target = args?.[0]; // 'warn' | 'mute'
    const fromArg = Array.isArray(args) ? args.find(a => String(a).startsWith('from:')) : null;
    const from = fromArg ? String(fromArg).split(':')[1] : null; // 'warn' | 'mute' | 'general'

    try {
      if (target === 'warn') {
        const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
        const current = cfg?.enabled !== false; // default true
        await client.prisma.warnConfig.upsert({
          where: { guildId },
          update: { enabled: !current },
          create: { guildId, enabled: !current },
        });
      } else if (target === 'mute') {
        const guildRow = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
        const current = guildRow?.muteEnabled !== false; // default true
        await client.prisma.guild.upsert({
          where: { id: guildId },
          update: { muteEnabled: !current },
          create: { id: guildId, muteEnabled: !current },
        });
      }
    } catch (e) {
      client.logs.warn?.(`Toggle error: ${e.message}`);
    }

    // Rebuild UI according to context
    try {
      const base = buildBaseContainer();
      let components = [base];
      if (from === 'warn') {
        const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
        const isEnabled = cfg?.enabled !== false;
        const section = new SectionBuilder()
          .setButtonAccessory(btn => btn
            .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setLabel(isEnabled ? 'Enabled' : 'Disabled')
            .setCustomId(`${TOGGLE_BUTTON_ID}-warn-from:warn`)
          )
          .addTextDisplayComponents(text => text.setContent('> ### Warn'));
        components.push(new ContainerBuilder().addSectionComponents(section));
      } else if (from === 'mute') {
        const guildRow = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
        const isEnabled = guildRow?.muteEnabled !== false;
        const section = new SectionBuilder()
          .setButtonAccessory(btn => btn
            .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setLabel(isEnabled ? 'Enabled' : 'Disabled')
            .setCustomId(`${TOGGLE_BUTTON_ID}-mute-from:mute`)
          )
          .addTextDisplayComponents(text => text.setContent('> ### Mute'));
        components.push(new ContainerBuilder().addSectionComponents(section));
      } else if (from === 'general') {
        const generics = await buildGeneralContainers(interaction, client);
        components = [base, ...generics];
      }
      await interaction.update({ components, flags: MessageFlags.IsComponentsV2 });
    } catch {
      await interaction.deferUpdate();
    }
  },
};

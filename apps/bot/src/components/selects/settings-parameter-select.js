const {
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder, 
  SeparatorSpacingSize,
} = require('discord.js');

const SELECT_ID = 'settings:select';
const OPTION_WARN = 'warn';
const OPTION_MUTE = 'mute';
const OPTION_ECONOMY = 'economy';
const OPTION_LEVELING = 'leveling';
const OPTION_GENERAL = 'general';
const REFRESH_BUTTON_ID = 'settings:refresh';
const TOGGLE_BUTTON_ID = 'settings:toggle';

function buildBaseContainer() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder('   ')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_WARN)
        .setDescription('  '),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_MUTE)
        .setDescription('  '),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_ECONOMY)
        .setDescription('  '),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_LEVELING)
        .setDescription('  '),
      new StringSelectMenuOptionBuilder()
        .setLabel(' ')
        .setValue(OPTION_GENERAL)
        .setDescription('  ')
    );

  const refreshBtn = new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel(' ')
    .setCustomId(REFRESH_BUTTON_ID);

  return new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(select))
    .addActionRowComponents(row => row.setComponents(refreshBtn));
}

async function buildWarnContainers(interaction, client) {
  const guildId = interaction.guildId;
  let isEnabled = true;
  if (process.env.USE_API_DB === 'true') {
    try {
      const WarnService = require('../../services/WarnService');
      const svc = WarnService();
      const s = await svc.getSettings(guildId);
      isEnabled = s?.enabled !== false;
    } catch (_) {
      isEnabled = true;
    }
  } else {
    const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
    isEnabled = cfg?.enabled !== false;
  }

  // Single warn settings page container
  const warnPageContainer = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setLabel(isEnabled ? 'Enabled' : 'Disabled')
            .setCustomId(`${TOGGLE_BUTTON_ID}-warn-from:warn`)
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
    );

  return [warnPageContainer];
}

async function buildGeneralContainers(interaction, client) {
  const guildId = interaction.guildId;
  let warnEnabled = true;
  let muteEnabled = true;
  let logChannelId = null;
  let muteRoleId = null;
  if (process.env.USE_API_DB === 'true') {
    try {
      const WarnService = require('../../services/WarnService');
      const svc = WarnService();
      const s = await svc.getSettings(guildId);
      warnEnabled = s?.enabled !== false;
      // logChannelId could be part of warns schema later; default null for now
    } catch (_) {}
    // mute settings are part of Guild DB in old model; default to true here
  } else {
    const [cfg, guildRow] = await Promise.all([
      client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null),
      client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null),
    ]);
    warnEnabled = cfg?.enabled !== false;
    muteEnabled = guildRow?.muteEnabled !== false;
    logChannelId = cfg?.logChannelId ?? null;
    muteRoleId = guildRow?.muteRoleId ?? null;
  }

  const statusText = [
    `> ###   `,
    `>   ****: ${warnEnabled ? ' ' : ' '}`,
    `>   ****: ${muteEnabled ? ' ' : ' '}`,
    `>   ****: ${logChannelId ? `<#${logChannelId}>` : '  '}`,
    `>   ** **: ${muteRoleId ? `<@&${muteRoleId}>` : '  '}`,
  ].join('\n');

  const header = new ContainerBuilder().addSectionComponents(
    new SectionBuilder()
      .setButtonAccessory(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel(' ')
          .setCustomId('settings:info-general')
          .setDisabled(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(statusText)
      )
  );

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('settings:set-log')
    .setPlaceholder('    ')
    .setMaxValues(1)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('settings:set-muteRole')
    .setPlaceholder('    ')
    .setMaxValues(1);

  const toggleWarn = new ButtonBuilder()
    .setStyle(warnEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
    .setLabel(warnEnabled ? ' : ' : ' : ')
    .setCustomId('settings:toggle-warn-from:general');

  const toggleMute = new ButtonBuilder()
    .setStyle(muteEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
    .setLabel(muteEnabled ? ' : ' : ' : ')
    .setCustomId('settings:toggle-mute-from:general');

  const controls = new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(channelSelect))
    .addActionRowComponents(row => row.setComponents(roleSelect))
    .addActionRowComponents(row => row.setComponents(toggleWarn, toggleMute));

  return [header, controls];
}

async function buildEconomyContainers(interaction, client) {
  const guildId = interaction.guildId;
  let basePrice = 100;
  let slope = 0.001;
  let totalCur1 = 0;
  let totalCur2 = 0;
  if (process.env.USE_API_DB !== 'true' && client.prisma?.economyConfig?.findUnique) {
    const economyConfig = await client.prisma.economyConfig.findUnique({ where: { guildId } }).catch(() => null);
    basePrice = economyConfig?.basePrice ?? 100;
    slope = economyConfig?.slope ?? 0.001;

    // Get current total currency supply for price calculation
    try {
      const agg = await client.prisma.economyBalance.aggregate({
        where: { guildId },
        _sum: { cur1: true, cur2: true },
      });
      totalCur1 = agg?._sum?.cur1 ?? 0;
      totalCur2 = agg?._sum?.cur2 ?? 0;
    } catch {}
  }
  const currentPrice = basePrice + slope * totalCur1;

  const statusText = [
    `> ###   `,
    `>   **  **: ${totalCur1.toLocaleString()}`,
    `>   **  **: ${totalCur2.toLocaleString()}`,
    `>   ** **: ${currentPrice.toFixed(2)} /`,
    `>   ** **: ${basePrice} `,
    `>   ****: ${slope}`,
  ].join('\n');

  const statusSection = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel(' ')
            .setCustomId('settings:economy-stats')
            .setDisabled(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(statusText)
        )
    );

  const configText = [
    `> ###   `,
    `>      `,
  ].join('\n');

  const configSection = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel('')
            .setCustomId('settings:economy-config')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(configText)
        )
    );

  const controlsSection = new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId('settings:economy-field:basePrice-op:dec')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('  '),
      new ButtonBuilder()
        .setCustomId('settings:economy-field:basePrice-op:inc')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('  '),
      new ButtonBuilder()
        .setCustomId('settings:economy-field:slope-op:dec')
        .setStyle(ButtonStyle.Secondary)
        .setLabel(' '),
      new ButtonBuilder()
        .setCustomId('settings:economy-field:slope-op:inc')
        .setStyle(ButtonStyle.Secondary)
        .setLabel(' ')
    ));

  return [statusSection, configSection, controlsSection];
}

async function buildLevelingContainers(interaction, client) {
  const guildId = interaction.guildId;
  let roleStacking = true; // default
  let voiceCooldown = 60; // seconds default
  try {
    const LevelingSettingsService = require('../../services/LevelingSettingsService');
    const svc = LevelingSettingsService();
    const s = await svc.get(guildId);
    // API values
    roleStacking = s?.roleStacking !== false; // default true
    voiceCooldown = Number.isFinite(s?.voiceCooldown) ? s.voiceCooldown : 60;
  } catch (_) {
    // fall back to defaults
  }

  const statusText = [
    `> ###   `,
  ].join('\n');

  // Replace SectionBuilder usage to avoid validation issues; use plain text block
  const statusHeader = new TextDisplayBuilder().setContent(statusText);

  // Roles configured via API
  let apiRewards = [];
  try {
    const LevelingSettingsService = require('../../services/LevelingSettingsService');
    const svc = LevelingSettingsService();
    const s = await svc.get(guildId);
    apiRewards = Array.isArray(s?.roleRewards) ? s.roleRewards : [];
  } catch {}

  // Resolve guild & roles cache once
  const guildObj = interaction.guild ?? client.guilds?.cache?.get(guildId) ?? null;
  const rolesCache = guildObj?.roles?.cache;

  // Preselect existing configured roles in the RoleSelect
  let defaultRoleIds = apiRewards.map(r => r.roleId);
  defaultRoleIds = defaultRoleIds.filter(id => rolesCache?.has?.(id));

  const addRolesRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('settings:leveling-roles-add')
      .setPlaceholder('   ')
      .setMinValues(0)
      .setMaxValues(15)
      .setDefaultRoles(...defaultRoleIds)
  );

  // Build options for existing roles list
  const opts = [];
  // Build options from API rewards
  for (const r of apiRewards) {
    const role = rolesCache?.get?.(r.roleId);
    const level = r.level ?? r.minLevel ?? 1;
    const label = role ? `${role.name}  L${level}` : `@unknown(${r.roleId})  L${level}`;
    opts.push(new StringSelectMenuOptionBuilder().setLabel(label).setValue(String(r.roleId)));
  }
  if (opts.length === 0) {
    opts.push(new StringSelectMenuOptionBuilder().setLabel('  ').setValue('none').setDefault(true));
  }

  const listRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('settings:leveling-role-edit')
      .setPlaceholder('    ')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(...opts)
  );

  // Fetch ignore entries via API
  let defaultIgnoredChannelIds = [], defaultIgnoredUserIds = [], defaultIgnoredRoleIds = [];
  try {
    const LevelingIgnoresService = require('../../services/LevelingIgnoresService');
    const igSvc = LevelingIgnoresService();
    const ig = await igSvc.get(guildId);
    defaultIgnoredChannelIds = (ig.Channel || []).filter(id => guildObj?.channels?.cache?.has?.(id));
    defaultIgnoredUserIds = (ig.User || []).filter(id => client.users?.cache?.has?.(id));
    defaultIgnoredRoleIds = (ig.Role || []).filter(id => rolesCache?.has?.(id));
  } catch {}

  const panelContainer = new ContainerBuilder()
    .addTextDisplayComponents(statusHeader)
    // Level roles section first
    .addActionRowComponents(addRolesRow)
    .addActionRowComponents(listRow)
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    )
    .addSectionComponents(
      new SectionBuilder()
          .setButtonAccessory(
              new ButtonBuilder()
              .setStyle(roleStacking ? ButtonStyle.Success : ButtonStyle.Danger)
              .setLabel(roleStacking ? ' : .' : ' : .')
              .setCustomId('settings:leveling-toggle-stacking')
          )
          .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("> ###  "),
          ),
  )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('> ###  ,   '))
    .addActionRowComponents(row => row.setComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('settings:leveling-ignore-channels')
        .setPlaceholder(' ')
        .setMinValues(0)
        .setMaxValues(25)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement)
        .setDefaultChannels(...defaultIgnoredChannelIds)
    ))
    .addActionRowComponents(row => row.setComponents(
      new MentionableSelectMenuBuilder()
        .setCustomId('settings:leveling-ignore-mentionables')
        .setPlaceholder('   ')
        .setMinValues(0)
        .setMaxValues(25)
    ));

  return [panelContainer];
}

module.exports = {
  customId: SELECT_ID,
  async execute(interaction, _args, client) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const value = interaction.values?.[0];

    const baseContainer = buildBaseContainer();
    let containers = [baseContainer];

    if (value === OPTION_WARN) {
      const warnContainers = await buildWarnContainers(interaction, client);
      containers = [baseContainer, ...warnContainers];
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
    } else if (value === OPTION_ECONOMY) {
      const economyContainers = await buildEconomyContainers(interaction, client);
      containers = [baseContainer, ...economyContainers];
    } else if (value === OPTION_GENERAL) {
      const generalContainers = await buildGeneralContainers(interaction, client);
      containers = [baseContainer, ...generalContainers];
    } else if (value === OPTION_LEVELING) {
      const levelingContainers = await buildLevelingContainers(interaction, client);
      containers = [baseContainer, ...levelingContainers];
    }

    await interaction.update({ components: containers, flags: MessageFlags.IsComponentsV2 });
  },
};


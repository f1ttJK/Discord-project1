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
        .setLabel('📈 Уровни')
        .setValue(OPTION_LEVELING)
        .setDescription('Настройка системы уровней'),
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

async function buildWarnContainers(interaction, client) {
  const guildId = interaction.guildId;
  const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
  const isEnabled = cfg?.enabled !== false;

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
    );

  return [warnPageContainer];
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
  const muteRoleId = guildRow?.muteRoleId ?? null;

  const statusText = [
    `> ### ⚙️ Общие настройки`,
    `> • ⚠️ **Предупреждения**: ${warnEnabled ? '✅ Включено' : '❌ Отключено'}`,
    `> • 🔇 **Мут**: ${muteEnabled ? '✅ Включено' : '❌ Отключено'}`,
    `> • 📝 **Логи**: ${logChannelId ? `<#${logChannelId}>` : '❌ не установлено'}`,
    `> • 📜 **Роль мута**: ${muteRoleId ? `<@&${muteRoleId}>` : '❌ не установлено'}`,
  ].join('\n');

  const header = new ContainerBuilder().addSectionComponents(
    new SectionBuilder()
      .setButtonAccessory(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel('📊 Инфо')
          .setCustomId('settings:info-general')
          .setDisabled(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(statusText)
      )
  );

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('settings:set-log')
    .setPlaceholder('📝 Выберите канал для логов')
    .setMaxValues(1)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('settings:set-muteRole')
    .setPlaceholder('📜 Выберите роль для мута')
    .setMaxValues(1);

  const toggleWarn = new ButtonBuilder()
    .setStyle(warnEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
    .setLabel(warnEnabled ? '⚠️ Предупреждения: Вкл' : '⚠️ Предупреждения: Откл')
    .setCustomId('settings:toggle-warn-from:general');

  const toggleMute = new ButtonBuilder()
    .setStyle(muteEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
    .setLabel(muteEnabled ? '🔇 Мут: Вкл' : '🔇 Мут: Откл')
    .setCustomId('settings:toggle-mute-from:general');

  const controls = new ContainerBuilder()
    .addActionRowComponents(row => row.setComponents(channelSelect))
    .addActionRowComponents(row => row.setComponents(roleSelect))
    .addActionRowComponents(row => row.setComponents(toggleWarn, toggleMute));

  return [header, controls];
}

async function buildEconomyContainers(interaction, client) {
  const guildId = interaction.guildId;
  const economyConfig = await client.prisma.economyConfig.findUnique({ where: { guildId } }).catch(() => null);
  const basePrice = economyConfig?.basePrice ?? 100;
  const slope = economyConfig?.slope ?? 0.001;

  // Get current total currency supply for price calculation
  const agg = await client.prisma.economyBalance.aggregate({
    where: { guildId },
    _sum: { cur1: true, cur2: true },
  }).catch(() => ({ _sum: { cur1: 0, cur2: 0 } }));
  
  const totalCur1 = agg._sum.cur1 ?? 0;
  const totalCur2 = agg._sum.cur2 ?? 0;
  const currentPrice = basePrice + slope * totalCur1;

  const statusText = [
    `> ### 💰 Экономическая система`,
    `> • 💵 **Люмины в обороте**: ${totalCur1.toLocaleString()}`,
    `> • 💰 **Русраб в обороте**: ${totalCur2.toLocaleString()}`,
    `> • 💹 **Текущая цена**: ${currentPrice.toFixed(2)} Люмин/Русраб`,
    `> • 🏦 **Базовая цена**: ${basePrice} Люмин`,
    `> • 📈 **Наклон**: ${slope}`,
  ].join('\n');

  const statusSection = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel('📊 Статистика')
            .setCustomId('settings:economy-stats')
            .setDisabled(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(statusText)
        )
    );

  const configText = [
    `> ### ⚙️ Параметры экономики`,
    `> Настройка базовой цены и коэффициента роста`,
  ].join('\n');

  const configSection = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel('⚙️')
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
        .setLabel('➖ Базовая цена'),
      new ButtonBuilder()
        .setCustomId('settings:economy-field:basePrice-op:inc')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('➕ Базовая цена'),
      new ButtonBuilder()
        .setCustomId('settings:economy-field:slope-op:dec')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('➖ Наклон'),
      new ButtonBuilder()
        .setCustomId('settings:economy-field:slope-op:inc')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('➕ Наклон')
    ));

  return [statusSection, configSection, controlsSection];
}

async function buildLevelingContainers(interaction, client) {
  const guildId = interaction.guildId;
  const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null);
  const roleStacking = cfg?.roleStacking !== false; // default true
  const voiceCooldown = cfg?.voiceCooldown ?? 60; // seconds

  const statusText = [
    `> ### 📈 Система рівнів`,
  ].join('\n');

  // Replace SectionBuilder usage to avoid validation issues; use plain text block
  const statusHeader = new TextDisplayBuilder().setContent(statusText);

  // Build Leveling Roles UI (guard when model is not generated yet)
  let existing = [];
  try {
    if (client.prisma?.levelingRole?.findMany) {
      existing = await client.prisma.levelingRole.findMany({
        where: { guildId },
        orderBy: { order: 'asc' },
      });
    }
  } catch {}

  // Resolve guild & roles cache once
  const guildObj = interaction.guild ?? client.guilds?.cache?.get(guildId) ?? null;
  const rolesCache = guildObj?.roles?.cache;

  // Preselect existing configured roles in the RoleSelect
  const defaultRoleIds = (existing || [])
    .map(r => r.roleId)
    .filter(id => rolesCache?.has?.(id));

  const addRolesRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('settings:leveling-roles-add')
      .setPlaceholder('Виберіть ролі для рівнів')
      .setMinValues(0)
      .setMaxValues(15)
      .setDefaultRoles(...defaultRoleIds)
  );

  // Build options for existing roles list
  const opts = [];
  for (const r of existing) {
    const role = rolesCache?.get?.(r.roleId);
    const label = role ? `${role.name} • L${r.minLevel}` : `@unknown(${r.roleId}) • L${r.minLevel}`;
    opts.push(new StringSelectMenuOptionBuilder().setLabel(label).setValue(String(r.id)));
  }
  if (opts.length === 0) {
    opts.push(new StringSelectMenuOptionBuilder().setLabel('Немає налаштованих ролей').setValue('none').setDefault(true));
  }

  const listRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('settings:leveling-role-edit')
      .setPlaceholder('Виберіть роль для редагування рівня')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(...opts)
  );

  // Single container combining status + controls (per request)
  // Fetch ignore entries up-front (no await inside builders)
  let ignoreChannels = [], ignoreUsers = [], ignoreRoles = [];
  try {
    if (client.prisma?.levelingIgnore?.findMany) {
      [ignoreChannels, ignoreUsers, ignoreRoles] = await Promise.all([
        client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Channel' } }),
        client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'User' } }),
        client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Role' } }),
      ]);
    }
  } catch {}

  const defaultIgnoredChannelIds = ignoreChannels
    .map(r => r.targetId)
    .filter(id => guildObj?.channels?.cache?.has?.(id));
  const defaultIgnoredUserIds = ignoreUsers
    .map(r => r.targetId)
    .filter(id => client.users?.cache?.has?.(id));
  const defaultIgnoredRoleIds = ignoreRoles
    .map(r => r.targetId)
    .filter(id => rolesCache?.has?.(id));

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
              .setLabel(roleStacking ? 'Стек ролів: Увімк.' : 'Стек ролів: Вимк.')
              .setCustomId('settings:leveling-toggle-stacking')
          )
          .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("> ### Стек ролів"),
          ),
  )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('> ### Ігнор каналів, користувачів і ролей'))
    .addActionRowComponents(row => row.setComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('settings:leveling-ignore-channels')
        .setPlaceholder('Ігнор каналів')
        .setMinValues(0)
        .setMaxValues(25)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement)
        .setDefaultChannels(...defaultIgnoredChannelIds)
    ))
    .addActionRowComponents(row => row.setComponents(
      new MentionableSelectMenuBuilder()
        .setCustomId('settings:leveling-ignore-mentionables')
        .setPlaceholder('Ігнор користувачів і ролей')
        .setMinValues(0)
        .setMaxValues(25)
    ));

  return [panelContainer];
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

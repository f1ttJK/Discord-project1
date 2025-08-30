const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение участнику')
    .addUserOption(o => o.setName('user').setDescription('Кому выдать предупреждение').setRequired(true))
    .addIntegerOption(o => o.setName('days').setDescription('Через сколько дней истечёт предупреждение').setMinValue(1))
    ,
  guildOnly: true,
  cooldown: 3,
  // Проверка прав через общий валидатор
  perms: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, client) {
    const guild = interaction.guild;
    const moderator = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    const customDays = interaction.options.getInteger('days');

    if (!guild) return interaction.reply({ content: 'Команда доступна только на сервере.', flags: MessageFlags.Ephemeral });
    if (targetUser.bot) return interaction.reply({ content: 'Нельзя выдавать предупреждение ботам.', flags: MessageFlags.Ephemeral });
    if (targetUser.id === moderator.id) return interaction.reply({ content: 'Вы не можете выдать предупреждение самому себе.', flags: MessageFlags.Ephemeral });

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден на сервере.', flags: MessageFlags.Ephemeral });

    const guildId = guild.id;
    // Check if warn system enabled for this guild
    const cfgEnabledCheck = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
    if (cfgEnabledCheck?.enabled === false) {
      return interaction.reply({ content: 'Система предупреждений отключена администраторами сервера.', flags: MessageFlags.Ephemeral });
    }
    const userId = targetUser.id;
    const moderatorId = moderator.id;

    // Загрузка конфигурации (или значения по умолчанию)
    const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
    const muteThreshold = cfg?.muteThreshold ?? 3;
    const kickThreshold = cfg?.kickThreshold ?? 5;
    const banThreshold  = cfg?.banThreshold  ?? 7;
    const muteDurationMin = cfg?.muteDurationMin ?? 60; // 1 час по умолчанию
    const defaultExpiryDays = cfg?.expiryDays ?? null;

    // Получить активные предустановленные причины
    const activeReasons = await client.prisma.warnReason.findMany({ where: { guildId, active: true }, orderBy: { id: 'asc' } });
    if (!activeReasons.length) {
      return interaction.reply({ content: 'Нет активных предустановленных причин. Добавьте их через /warnpanel.', flags: MessageFlags.Ephemeral });
    }

    const daysParam = customDays ?? (cfg?.expiryDays ?? 'null');
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`WARN_SELECT_REASON-${userId}-${daysParam}`)
      .setPlaceholder('Выберите причину')
      .addOptions(activeReasons.slice(0, 25).map(r => ({ label: r.label.slice(0, 100), value: r.label.slice(0, 100) })));

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({ content: `Кому: <@${userId}>. Выберите причину из списка:`, components: [row], flags: MessageFlags.Ephemeral });
  }
};

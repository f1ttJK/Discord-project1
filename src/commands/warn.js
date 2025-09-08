const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение участнику')
    .addUserOption(o => o.setName('user').setDescription('Кому выдать предупреждение').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина (из настроек)').setRequired(true).setAutocomplete(true)),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ModerateMembers],

  async autocomplete(interaction, client) {
    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.respond([]);
    const focused = interaction.options.getFocused(true).value;
    const reasons = await client.prisma.warnReason.findMany({
      where: {
        guildId,
        active: true,
        label: { contains: focused, mode: 'insensitive' }
      },
      orderBy: { id: 'asc' },
      take: 25
    }).catch(() => []);
    await interaction.respond(reasons.map(r => ({ name: r.label.slice(0, 100), value: r.label.slice(0, 100) })));
  },

  async execute(interaction, client) {
    const guild = interaction.guild;
    const moderator = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    const reasonLabel = interaction.options.getString('reason', true);

    if (!guild) return interaction.reply({ content: 'Команда доступна только на сервере.', flags: MessageFlags.Ephemeral });
    if (targetUser.bot) return interaction.reply({ content: 'Нельзя выдавать предупреждение ботам.', flags: MessageFlags.Ephemeral });
    if (targetUser.id === moderator.id) return interaction.reply({ content: 'Вы не можете выдать предупреждение самому себе.', flags: MessageFlags.Ephemeral });

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден на сервере.', flags: MessageFlags.Ephemeral });

    const guildId = guild.id;
    const cfgEnabled = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
    if (cfgEnabled?.enabled === false) {
      return interaction.reply({ content: 'Система предупреждений отключена администраторами сервера.', flags: MessageFlags.Ephemeral });
    }

    const reason = await client.prisma.warnReason.findFirst({ where: { guildId, label: reasonLabel, active: true } }).catch(() => null);
    if (!reason) {
      return interaction.reply({ content: 'Причина не найдена или отключена. Укажите одну из причин из настроек.', flags: MessageFlags.Ephemeral });
    }

    const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
    const muteThreshold = cfg?.muteThreshold ?? 3;
    const kickThreshold = cfg?.kickThreshold ?? 5;
    const banThreshold = cfg?.banThreshold ?? 7;
    const muteDurationMin = cfg?.muteDurationMin ?? 60;
    const expiryDays = cfg?.expiryDays ?? null;

    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

    await client.prisma.warn.create({ data: { guildId, userId: targetUser.id, moderatorId: moderator.id, reason: reason.label, expiresAt } });

    const warnCount = await client.prisma.warn.count({ where: { guildId, userId: targetUser.id } });

    let actionText = '';
    try {
      if (warnCount >= banThreshold) {
        await member.ban({ reason: 'Превышен лимит предупреждений' });
        actionText = 'Пользователь забанен.';
      } else if (warnCount >= kickThreshold) {
        await member.kick('Превышен лимит предупреждений');
        actionText = 'Пользователь кикнут.';
      } else if (warnCount >= muteThreshold) {
        const guildRow = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
        const roleId = guildRow?.muteRoleId;
        const durationMin = muteDurationMin;
        if (roleId) {
          const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
          const me = guild.members.me;
          if (role && me && role.position < me.roles.highest.position) {
            await member.roles.add(role, `Авто-мут на ${durationMin} мин.`);
            setTimeout(async () => {
              const fresh = await guild.members.fetch(targetUser.id).catch(() => null);
              if (fresh && fresh.roles.cache.has(role.id)) {
                fresh.roles.remove(role, 'Окончание мута').catch(() => null);
              }
            }, durationMin * 60 * 1000);
            actionText = `Выдан мут на ${durationMin} мин.`;
          } else {
            await member.timeout(durationMin * 60 * 1000, 'Авто-мут по количеству предупреждений');
            actionText = `Выдан таймаут на ${durationMin} мин.`;
          }
        } else {
          await member.timeout(durationMin * 60 * 1000, 'Авто-мут по количеству предупреждений');
          actionText = `Выдан таймаут на ${durationMin} мин.`;
        }
      }
    } catch (e) {
      client.logs?.warn && client.logs.warn(`Warn action error: ${e.message}`);
    }

    const logChannelId = cfg?.logChannelId;
    if (logChannelId) {
      const fields = [
        { name: 'Причина', value: reason.label, inline: false },
        { name: 'Всего предупреждений', value: `${warnCount}`, inline: true }
      ];
      if (actionText) fields.push({ name: 'Действие', value: actionText, inline: true });
      const embed = new EmbedBuilder()
        .setColor(0x2F3136)
        .setTitle('Выдано предупреждение')
        .setDescription(`⚠️ <@${targetUser.id}> получил предупреждение от <@${moderator.id}>`)
        .addFields(fields)
        .setTimestamp();
      const ch = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
      if (ch && ch.isTextBased()) ch.send({ embeds: [embed] }).catch(() => null);
    }

    return interaction.reply({ content: `✅ Предупреждение выдано. Теперь предупреждений: ${warnCount}${actionText ? `\n${actionText}` : ''}`, flags: MessageFlags.Ephemeral });
  }
};

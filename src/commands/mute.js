const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Выдать мут участнику по причине из системы мутов')
    .addUserOption(o => o.setName('user').setDescription('Кого замьютить').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Название причины (из настроек мутов)').setRequired(true).setMaxLength(100)),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, client) {
    const guild = interaction.guild;
    const moderator = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    const reasonLabel = interaction.options.getString('reason', true);

    if (!guild) return interaction.reply({ content: 'Команда доступна только на сервере.', flags: MessageFlags.Ephemeral });
    if (targetUser.bot) return interaction.reply({ content: 'Нельзя мьютить ботов.', flags: MessageFlags.Ephemeral });
    if (targetUser.id === moderator.id) return interaction.reply({ content: 'Вы не можете замьютить самого себя.', flags: MessageFlags.Ephemeral });

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Пользователь не найден на сервере.', flags: MessageFlags.Ephemeral });

    const guildId = guild.id;
    // Check if mute system enabled for this guild
    const guildRow0 = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
    if (guildRow0?.muteEnabled === false) {
      return interaction.reply({ content: 'Система мутов отключена администраторами сервера.', flags: MessageFlags.Ephemeral });
    }

    // Найти причину мута в отдельной таблице
    const reason = await client.prisma.muteReason.findFirst({ where: { guildId, label: reasonLabel } });
    if (!reason || !reason.active) {
      return interaction.reply({ content: 'Причина не найдена или отключена. Проверьте название причины.', flags: MessageFlags.Ephemeral });
    }

    const cfg = await client.prisma.warnConfig.findUnique({ where: { guildId } }).catch(() => null);
    const guildRow = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
    const durationMin = reason.punishmentDurationMin ?? cfg?.muteDurationMin ?? 60;

    let applied = false;
    let actionText = '';
    try {
      if (reason.punishmentType === 'Mute') {
        const roleId = guildRow?.muteRoleId;
        if (!roleId) {
          return interaction.reply({ content: 'Мут-роль не настроена. Укажите её через /warnconfig setmuterole.', flags: MessageFlags.Ephemeral });
        }
        const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
        if (!role) return interaction.reply({ content: 'Указанная мут-роль не найдена.', flags: MessageFlags.Ephemeral });
        const me = guild.members.me;
        if (!me) return interaction.reply({ content: 'Бот не обнаружен как участник гильдии.', flags: MessageFlags.Ephemeral });
        if (role.position >= me.roles.highest.position) {
          return interaction.reply({ content: 'Не могу назначить роль мута: роль выше или равна роли бота.', flags: MessageFlags.Ephemeral });
        }
        await member.roles.add(role, `Мут по причине: ${reason.label}`);
        applied = true;
        actionText = `Ролевой мут (роль <@&${role.id}>) на ${durationMin} мин.`;
        setTimeout(async () => {
          const fresh = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!fresh) return;
          if (fresh.roles.cache.has(role.id)) {
            fresh.roles.remove(role, 'Окончание мута').catch(() => null);
          }
        }, durationMin * 60 * 1000);
      } else {
        const ms = durationMin * 60 * 1000;
        await member.timeout(ms, `Мут по причине: ${reason.label}`);
        applied = true;
        actionText = `Timeout на ${durationMin} мин.`;
      }
    } catch (e) {
      client.logs?.warn && client.logs.warn(`Не удалось применить мут: ${e.message}`);
    }

    // Логи
    const logChannelId = cfg?.logChannelId;
    if (applied && logChannelId) {
      const embed = new EmbedBuilder()
        .setColor(0x2F3136)
        .setTitle('Применён мут')
        .setDescription(`🔇 <@${targetUser.id}> замьючен модератором <@${moderator.id}>`)
        .addFields(
          { name: 'Причина', value: reason.label, inline: false },
          { name: 'Длительность', value: `${durationMin} мин.`, inline: true },
          { name: 'Тип', value: reason.punishmentType === 'Mute' ? 'Role Mute' : 'Timeout', inline: true },
        )
        .setTimestamp();
      const ch = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
      if (ch && ch.isTextBased()) ch.send({ embeds: [embed] }).catch(() => null);
    }

    return interaction.reply({ content: applied ? `✅ Применён мут: ${actionText}` : '❌ Не удалось применить мут.', flags: MessageFlags.Ephemeral });
  }
};

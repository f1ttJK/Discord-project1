const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Выдать временный мут пользователю')
    .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина (должна совпадать с преднастроенными)').setRequired(true).setMaxLength(100)),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, client) {
    const guild = interaction.guild;
    const moderator = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    const reasonLabel = interaction.options.getString('reason', true);

    if (!guild) return interaction.reply({ content: 'Команда доступна только на сервере.', flags: MessageFlags.Ephemeral });
    if (targetUser.bot) return interaction.reply({ content: 'Нельзя замьютить бота.', flags: MessageFlags.Ephemeral });
    if (targetUser.id === moderator.id) return interaction.reply({ content: 'Вы не можете замьютить себя.', flags: MessageFlags.Ephemeral });

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'Не удалось получить пользователя на сервере.', flags: MessageFlags.Ephemeral });

    const guildId = guild.id;
    // Check if mute system enabled for this guild
    const guildRow0 = await client.prisma.guild.findUnique({ where: { id: guildId } }).catch(() => null);
    if (guildRow0?.muteEnabled === false) {
      return interaction.reply({ content: 'Система мутов отключена на этом сервере.', flags: MessageFlags.Ephemeral });
    }

    //      
    const reason = await client.prisma.muteReason.findFirst({ where: { guildId, label: reasonLabel } });
    if (!reason || !reason.active) {
      return interaction.reply({ content: 'Указанная причина не найдена или отключена.', flags: MessageFlags.Ephemeral });
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
          return interaction.reply({ content: 'Mute-роль не настроена. Используйте /warnconfig setmuterole.', flags: MessageFlags.Ephemeral });
        }
        const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
        if (!role) return interaction.reply({ content: 'Указанная роль для мута не найдена.', flags: MessageFlags.Ephemeral });
        const me = guild.members.me;
        if (!me) return interaction.reply({ content: 'Не удалось определить бота на сервере.', flags: MessageFlags.Ephemeral });
        if (role.position >= me.roles.highest.position) {
          return interaction.reply({ content: 'У меня недостаточно прав, чтобы выдать эту роль.', flags: MessageFlags.Ephemeral });
        }
        await member.roles.add(role, `  : ${reason.label}`);
        applied = true;
        actionText = `Выдана роль <@&${role.id}> на ${durationMin} минут.`;
        setTimeout(async () => {
          const fresh = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!fresh) return;
          if (fresh.roles.cache.has(role.id)) {
            fresh.roles.remove(role, 'Автоматическое снятие мута.').catch(() => null);
          }
        }, durationMin * 60 * 1000);
      } else {
        const ms = durationMin * 60 * 1000;
        await member.timeout(ms, `Mute: ${reason.label}`);
        applied = true;
        actionText = `Тайм-аут на ${durationMin} минут.`;
      }
    } catch (e) {
      client.logs?.warn && client.logs.warn(`Ошибка применения наказания: ${e.message}`);
    }

    // 
    const logChannelId = cfg?.logChannelId;
    if (applied && logChannelId) {
      const embed = new EmbedBuilder()
        .setColor(0x2F3136)
        .setTitle('Выдан мут')
        .setDescription(`Пользователь <@${targetUser.id}> замьючен модератором <@${moderator.id}>`)
        .addFields(
          { name: 'Причина', value: reason.label, inline: false },
          { name: 'Длительность', value: `${durationMin} минут`, inline: true },
          { name: 'Тип', value: reason.punishmentType === 'Mute' ? 'Роль' : 'Тайм-аут', inline: true },
        )
        .setTimestamp();
      const ch = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
      if (ch && ch.isTextBased()) ch.send({ embeds: [embed] }).catch(() => null);
    }

    if (applied) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x2F3136)
          .setTitle('Вы были замьючены')
          .setDescription(`На сервере **${guild.name}** для вас применено наказание.`)
          .addFields(
            { name: 'Причина', value: reason.label, inline: false },
            { name: 'Длительность', value: `${durationMin} минут`, inline: true },
            { name: 'Тип', value: reason.punishmentType === 'Mute' ? 'Роль' : 'Тайм-аут', inline: true }
          )
          .setTimestamp();
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (e) {
        // ignore DM errors
      }
    }

    return interaction.reply({ content: applied ? `Наказание применено: ${actionText}` : 'Не удалось применить наказание.', flags: MessageFlags.Ephemeral });
  }
};


const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Отозвать предупреждение у пользователя')
    .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true))
    .addIntegerOption(o => o.setName('warn_id').setDescription('ID предупреждения (если не указать — снимется последнее активное)'))
    .addStringOption(o => o.setName('reason').setDescription('Причина отзыва (необязательно)')),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction, client) {
    const guild = interaction.guild;
    const moderator = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    const warnId = interaction.options.getInteger('warn_id', false);
    const revokeReason = interaction.options.getString('reason', false) || undefined;

    if (!guild) return interaction.reply({ content: 'Команда доступна только на сервере.', flags: MessageFlags.Ephemeral });
    if (targetUser.bot) return interaction.reply({ content: 'Нельзя снимать предупреждение с бота.', flags: MessageFlags.Ephemeral });

    try {
      if (process.env.USE_API_DB === 'true') {
        const WarnService = require('../../../services/WarnService');
        const svc = WarnService();
        const guildId = guild.id;
        let idToRevoke = warnId;
        if (!idToRevoke) {
          //     
          const warns = await svc.list(guildId, targetUser.id);
          const active = (warns || []).filter(w => !w.revokedAt);
          if (active.length === 0) {
            return interaction.reply({ content: 'Активных предупреждений не найдено.', flags: MessageFlags.Ephemeral });
          }
          idToRevoke = active[0].id; //    (list   id desc)
        }

        const revoked = await svc.revoke(guildId, idToRevoke, { revokedBy: moderator.id, revokeReason });
        if (!revoked) {
          return interaction.reply({ content: 'Не удалось отозвать предупреждение.', flags: MessageFlags.Ephemeral });
        }

        //    
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setTitle('Предупреждение отозвано')
            .setDescription(`На сервере **${guild.name}** было отозвано ваше предупреждение.`)
            .addFields(
              { name: 'ID предупреждения', value: String(revoked.id), inline: true },
              { name: 'Модератор', value: `<@${moderator.id}>`, inline: true },
              { name: 'Причина', value: revokeReason ? revokeReason : 'Не указана', inline: false },
            )
            .setFooter({ text: guild.name })
            .setTimestamp();
          await targetUser.send({ embeds: [dmEmbed] }).catch(() => null);
        } catch {}

        return interaction.reply({ content: `Предупреждение #${idToRevoke} отозвано.`, flags: MessageFlags.Ephemeral });
      }

      // Legacy path (Prisma)
      const prisma = client.prisma;
      if (!prisma) return interaction.reply({ content: 'База данных недоступна.', flags: MessageFlags.Ephemeral });
      const guildId = guild.id;
      let idToRevoke = warnId;
      if (!idToRevoke) {
        const last = await prisma.warn.findFirst({ where: { guildId, userId: targetUser.id, revokedAt: null }, orderBy: { id: 'desc' } });
        if (!last) return interaction.reply({ content: 'Активное предупреждение не найдено.', flags: MessageFlags.Ephemeral });
        idToRevoke = last.id;
      }
      await prisma.warn.update({ where: { id: idToRevoke }, data: { revokedAt: new Date(), revokedBy: moderator.id, revokeReason } });
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x2F3136)
          .setTitle('Предупреждение отозвано')
          .setDescription(`На сервере **${guild.name}** было отозвано ваше предупреждение.`)
          .addFields(
            { name: 'ID предупреждения', value: String(idToRevoke), inline: true },
            { name: 'Модератор', value: `<@${moderator.id}>`, inline: true },
            { name: 'Причина', value: revokeReason ? revokeReason : 'Не указана', inline: false },
          )
          .setFooter({ text: guild.name })
          .setTimestamp();
        await targetUser.send({ embeds: [dmEmbed] }).catch(() => null);
      } catch {}
      return interaction.reply({ content: `Предупреждение #${idToRevoke} отозвано.`, flags: MessageFlags.Ephemeral });
    } catch (e) {
      client.logs?.error?.(`unwarn error: ${e.message}`);
      return interaction.reply({ content: 'Произошла ошибка при отзыве предупреждения.', flags: MessageFlags.Ephemeral });
    }
  }
};


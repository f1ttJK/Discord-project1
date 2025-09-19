const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение пользователю')
    .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Причина (автодополнение)').setRequired(true).setAutocomplete(true)),
  guildOnly: true,
  cooldown: 3,
  perms: [PermissionFlagsBits.ModerateMembers],

  async autocomplete(interaction, client) {
    const guildId = interaction.guild?.id;
    if (!guildId) return interaction.respond([]);
    try {
      const WarnService = require('../../../services/WarnService');
      const svc = WarnService();
      const focused = interaction.options.getFocused(true);
      const search = typeof focused?.value === 'string' ? focused.value : '';
      const reasons = await svc.listReasons(guildId, { q: search, active: true });
      const items = reasons.slice(0, 25).map(r => ({ name: r.label.slice(0, 100), value: r.label.slice(0, 100) }));
      return interaction.respond(items);
    } catch {
      return interaction.respond([]);
    }
  },

  async execute(interaction, client) {
    const guild = interaction.guild;
    const moderator = interaction.member;
    const targetUser = interaction.options.getUser('user', true);
    const reasonLabel = interaction.options.getString('reason', true);

    if (!guild) return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
    if (targetUser.bot) return interaction.reply({ content: '   .', flags: MessageFlags.Ephemeral });
    if (targetUser.id === moderator.id) return interaction.reply({ content: '      .', flags: MessageFlags.Ephemeral });

    // API-backed implementation (API-only)
      const guildId = guild.id;
      const member = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });

      // 1) Check settings.enabled via API
      const WarnService = require('../../../services/WarnService');
      const warnSvc = WarnService();
      const settings = await warnSvc.getSettings(guildId).catch(() => null);
      if (settings && settings.enabled === false) {
        return interaction.reply({ content: '    .', flags: MessageFlags.Ephemeral });
      }

      // 2) Create warn via API (store reason label as provided string)
      // expiry from settings is not per-reason; keep null or could derive later
      const created = await warnSvc.create(guildId, {
        userId: targetUser.id,
        moderatorId: moderator.id,
        reason: reasonLabel,
      });

      // 3) Count warns and pick escalation rule
      const allWarns = await warnSvc.list(guildId, targetUser.id);
      const warnCount = Array.isArray(allWarns) ? allWarns.filter(w => !w.revokedAt).length : 0;

      const rules = await warnSvc.listEscalations(guildId).catch(() => []);
      const matched = (rules || [])
        .filter(r => typeof r.count === 'number' && warnCount >= r.count)
        .sort((a, b) => b.count - a.count)[0] || null;

      let actionText = '';
      try {
        if (matched) {
          const type = String(matched.action || 'none').toLowerCase();
          const durationMin = Number(matched.durationMinutes ?? 0);
          const durationMs = durationMin * 60 * 1000;
          if (type === 'ban') {
            await member.ban({ reason: `  (: ${warnCount})` });
            actionText = ' .';
          } else if (type === 'kick') {
            await member.kick(`  (: ${warnCount})`);
            actionText = ' .';
          } else if (type === 'mute') {
            if (Number.isFinite(durationMs) && durationMs > 0) {
              await member.timeout(durationMs, '-   ');
              actionText = `   ${durationMin} .`;
            }
          }
        }
      } catch (e) {
        client.logs?.warn?.(`Warn API escalation action error: ${e.message}`);
      }

      // 4) Log + DM notifications
      try {
        const logChannelId = settings?.logChannelId;
        if (logChannelId) {
          const ch = guild.channels.cache.get(logChannelId) || await guild.channels.fetch(logChannelId).catch(() => null);
          if (ch && ch.isTextBased()) {
            const fields = [
              { name: '', value: reasonLabel, inline: false },
              { name: ' ', value: String(warnCount), inline: true },
            ];
            if (actionText) fields.push({ name: '', value: actionText, inline: true });
            const embed = new EmbedBuilder()
              .setColor(0x2F3136)
              .setTitle(' ')
              .setDescription(` <@${targetUser.id}>    <@${moderator.id}>`)
              .addFields(fields)
              .setTimestamp();
            ch.send({ embeds: [embed] }).catch(() => null);
          }
        }
      } catch {}

      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x2F3136)
          .setTitle('')
          .setDescription(`     **${guild.name}**`)
          .addFields(
            { name: '', value: reasonLabel, inline: false },
            { name: '', value: `<@${moderator.id}>`, inline: true },
            { name: ' ', value: String(warnCount), inline: true },
          )
          .setFooter({ text: guild.name })
          .setTimestamp();
        await targetUser.send({ embeds: [dmEmbed] }).catch(() => null);
      } catch {}

      return interaction.reply({ content: `  .  : ${warnCount}${actionText ? `\n${actionText}` : ''}`, flags: MessageFlags.Ephemeral });
  }
};


const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Leveling = require('../../../services/LevelingService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Показати ваш рівень, EXP і прогрес до наступного рівня')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription('Користувач (за замовчуванням — ви)')
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const target = interaction.options.getUser('user') ?? interaction.user;
    const userId = target.id;

    // Ensure row exists
    const row = await client.prisma.member.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { xp: true, level: true, msgCount: true, voiceSeconds: true },
    });

    const totalXp = row?.xp ?? 0;
    const storedLevel = row?.level ?? 0;
    // Recompute level from total XP (authoritative) to be safe
    const level = Leveling.computeLevelFromTotalXp(totalXp);

    // Compute progress to next level
    const nextLevel = level + 1;
    const needForNext = Leveling.requiredForLevel(nextLevel);
    // Calculate remaining xp within current level band
    // We need cumulative consumed xp to current level
    let consumed = 0;
    for (let L = 1; L <= level; L++) consumed += Leveling.requiredForLevel(L);
    const inLevelXp = totalXp - consumed;
    const progress = needForNext > 0 ? Math.max(0, Math.min(1, inLevelXp / needForNext)) : 0;

    // Build simple text progress bar
    const barLen = 20;
    const filled = Math.round(barLen * progress);
    const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barLen - filled));

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ size: 64 }) })
      .setTitle('Рівень і прогрес')
      .addFields(
        { name: 'Рівень', value: `${level}`, inline: true },
        { name: 'EXP (всього)', value: `${totalXp}`, inline: true },
        { name: 'До наступного рівня', value: `${needForNext - inLevelXp} EXP`, inline: true },
      )
      .addFields(
        { name: `Прогрес до ${nextLevel} рівня`, value: `${bar} ${(progress * 100).toFixed(1)}%` }
      )
      .setFooter({ text: `Повідомлення: ${row?.msgCount ?? 0} • Голос: ${row?.voiceSeconds ?? 0}s` });

    // If stored level mismatches, update quietly (best-effort)
    if (storedLevel !== level) {
      client.prisma.member.update({
        where: { guildId_userId: { guildId, userId } },
        data: { level },
      }).catch(() => {});
    }

    await interaction.reply({ embeds: [embed] });
  }
};

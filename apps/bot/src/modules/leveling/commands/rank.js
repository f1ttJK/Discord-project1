const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Leveling = require('../../../services/LevelingService');
const { apiRequest } = require('../../../services/ApiClient');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('  , EXP     ')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription(' (   )')
      .setRequired(false)
    ),
  guildOnly: true,
  cooldown: 5,

  async execute(interaction, client) {
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const target = interaction.options.getUser('user') ?? interaction.user;
    const userId = target.id;

    // API-only: fetch member stats from API
    let row = null;
    try {
      row = await apiRequest(`/v1/leveling/${guildId}/member/${userId}`);
    } catch (e) {
      return interaction.reply({ content: `      API: ${e.message}`, flags: MessageFlags.Ephemeral });
    }

    const totalXp = Number(row?.xp ?? 0);
    const storedLevel = Number(row?.level ?? 0);
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
    const bar = ''.repeat(filled) + ''.repeat(Math.max(0, barLen - filled));

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ size: 64 }) })
      .setTitle('  ')
      .addFields(
        { name: '', value: `${level}`, inline: true },
        { name: 'EXP ()', value: `${totalXp}`, inline: true },
        { name: '  ', value: `${needForNext - inLevelXp} EXP`, inline: true },
      )
      .addFields(
        { name: `  ${nextLevel} `, value: `${bar} ${(progress * 100).toFixed(1)}%` }
      )
      .setFooter({ text: `: ${row?.msgCount ?? 0}  : ${row?.voiceSeconds ?? 0}s` });

    await interaction.reply({ embeds: [embed] });
  }
};


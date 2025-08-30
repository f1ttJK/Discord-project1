const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { renderCard } = require('../utils/profileCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Показати профіль з активністю (повідомлення, час у голосі)')
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

    // Ensure guild member to get display name and avatar
    const member = await guild.members.fetch(userId).catch(() => null);
    const displayName = member?.displayName ?? target.username;
    const avatarUrl = (member ?? target).displayAvatarURL({ extension: 'png', size: 256 });
    // Highest role (exclude @everyone which has id == guildId). Pass even if colorless.
    let roleName = undefined;
    let roleColor = undefined;
    let roleIconUrl = undefined;
    let joinedTimestamp = undefined;
    if (member) {
      const highest = member.roles?.highest ?? null;
      if (highest && highest.id !== guildId) {
        roleName = highest.name;
        roleColor = highest.hexColor; // '#000000' when the role has no color
        // role icon url if present
        try {
          if (typeof highest.iconURL === 'function') {
            roleIconUrl = highest.iconURL({ size: 64, extension: 'png' }) ?? undefined;
          }
        } catch {}
      }
      joinedTimestamp = member.joinedTimestamp ?? member.joinedAt?.getTime?.() ?? undefined;
    }

    // Read stats
    const m = await client.prisma.member.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    const voiceSeconds = m?.voiceSeconds ?? 0;
    const msgCount = m?.msgCount ?? 0;

    // Compute ranks (1-based). If user has 0 — он будет внизу списков.
    const [higherVoice, higherMsg] = await Promise.all([
      client.prisma.member.count({ where: { guildId, voiceSeconds: { gt: voiceSeconds } } }),
      client.prisma.member.count({ where: { guildId, msgCount: { gt: msgCount } } }),
    ]);
    const voiceTop = higherVoice + 1;
    const msgTop = higherMsg + 1;

    // Economy balances and rank by Русраб (cur1)
    const bal = await client.prisma.economyBalance.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    // cur1 = Люмiни, cur2 = Русраб (смотри /balance)
    const lumini = bal?.cur1 ?? 0; // Люмiни
    const rusrab = bal?.cur2 ?? 0; // Русраб
    let rusrabTop = undefined;
    try {
      // rank = count of users with greater cur2 (Русраб) + 1, only within this guild
      const higher = await client.prisma.economyBalance.count({ where: { guildId, cur2: { gt: rusrab } } });
      rusrabTop = higher + 1;
    } catch {}

    // Render card
    const buffer = await renderCard({
      displayName,
      avatarUrl,
      voiceSeconds,
      voiceTop,
      msgCount,
      msgTop,
      roleName,
      roleColor,
      roleIconUrl,
      joinedTimestamp,
      rusrab,
      lumini,
      rusrabTop,
    });

    const file = new AttachmentBuilder(buffer, { name: 'profile.png' });
    await interaction.reply({ files: [file] });
  }
};

// ensureGuildAndUser removed; using connectOrCreate instead
const Leveling = require('../services/LevelingService');
const RoleService = require('../services/RoleService');

module.exports = {
  event: 'messageCreate',
  async execute(message, client) {
    try {
      if (!message.guild || message.author.bot) return;
      if (!message.content || message.content.length < 2) return;

      const guildId = message.guild.id;
      const userId = message.author.id;

      // Ignore lists: channels, users, roles
      try {
        const [ignCh, ignUsers, ignRoles] = await Promise.all([
          client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Channel' } }),
          client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'User' } }),
          client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Role' } }),
        ]);
        const chIgnored = ignCh.some(r => r.targetId === message.channelId);
        const userIgnored = ignUsers.some(r => r.targetId === userId);
        const roles = message.member?.roles?.cache;
        const roleIgnored = roles ? ignRoles.some(r => roles.has(r.targetId)) : false;
        if (chIgnored || userIgnored || roleIgnored) return; // skip accrual entirely
      } catch {}

      // Ensure related Guild and User exist to satisfy FK constraints
      await client.prisma.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId },
      });
      await client.prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      });

      // Ensure Member exists and increment message count for activity tracking
      await client.prisma.member.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: {
          guildId,
          userId,
          xp: 0,
          level: 0,
          msgCount: 1,
          voiceSeconds: 0,
        },
        update: { msgCount: { increment: 1 } },
      });

      // Add leveling EXP with its own cooldown (independent from economy)
      try {
        const { addedXp, newLevel, oldLevel } = await Leveling.addMessageXp(client, guildId, userId, new Date());
        if (addedXp > 0 && newLevel !== null && oldLevel !== null && newLevel > oldLevel) {
          await RoleService.syncLevelRoles(message.guild, userId, newLevel, client);
        }
      } catch (e) {
        client.logs?.error?.(`messageCreate leveling error: ${e.message}`);
      }

      const row = await client.prisma.economyBalance.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });

      const now = new Date();
      const last = row?.lastMsgEarnAt ?? null;
      const COOLDOWN_MS = 60 * 1000; // 1 min per reward
      const REWARD = 3; // cur1 per message on cooldown

      if (last && now - last < COOLDOWN_MS) return;

      await client.prisma.economyBalance.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: {
          guildId,
          userId,
          cur1: REWARD,
          cur2: 0,
          lastMsgEarnAt: now
        },
        update: { cur1: { increment: REWARD }, lastMsgEarnAt: now },
      });
    } catch (e) {
      client.logs?.error?.(`messageCreate earn error: ${e.message}`);
    }
  }
};

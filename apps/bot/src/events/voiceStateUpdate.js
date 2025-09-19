// ensureGuildAndUser removed; using connectOrCreate instead
const Leveling = require('../services/LevelingService');
const RoleService = require('../services/RoleService');
const { apiRequest } = require('../services/ApiClient');

// Local tracker for voice join times in API mode (no Prisma)
const lastVoiceJoin = new Map(); // key: `${guildId}:${userId}` -> Date

module.exports = {
  event: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    try {
      // In API DB mode: handle accrual via API
      if (!client.prisma) {
        const guildId = newState.guild?.id || oldState.guild?.id;
        if (!guildId) return;
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;
        const userId = member.id;

        const joinedNow = !!newState.channelId && !oldState.channelId;
        const leftNow = !!oldState.channelId && !newState.channelId;
        const movedNow = !!oldState.channelId && !!newState.channelId && oldState.channelId !== newState.channelId;

        const key = `${guildId}:${userId}`;
        const now = new Date();

        if (joinedNow) {
          lastVoiceJoin.set(key, now);
          return;
        }

        if (leftNow || movedNow) {
          const start = lastVoiceJoin.get(key);
          const ms = start ? Math.max(0, now - start) : 0;
          const seconds = Math.floor(ms / 1000);
          // Reset join if left; update to now if moved (to continue session for next hop)
          if (movedNow) {
            lastVoiceJoin.set(key, now);
          } else {
            lastVoiceJoin.delete(key);
          }
          if (seconds <= 0) return;
          try {
            const body = { guildId, userId, seconds, channelId: oldState.channelId || newState.channelId };
            const res = await apiRequest('/v1/leveling/voice', { method: 'POST', body });
            if (res?.leveledUp && typeof res.level === 'number') {
              await RoleService.syncLevelRoles(newState.guild || oldState.guild, userId, res.level, client);
            }
          } catch (e) {
            client.logs?.warn?.(`voice API emit failed: ${e.message}`);
          }
        }
        return;
      }

      const guildId = newState.guild?.id || oldState.guild?.id;
      if (!guildId) return;

      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;
      const userId = member.id;

      // Ensure FK targets exist
      await client.prisma.guild.upsert({ where: { id: guildId }, update: {}, create: { id: guildId } });
      await client.prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });

      const joinedNow = !!newState.channelId && !oldState.channelId;
      const leftNow = !!oldState.channelId && !newState.channelId;
      const movedNow = !!oldState.channelId && !!newState.channelId && oldState.channelId !== newState.channelId;

      const row = await client.prisma.economyBalance.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });

      const now = new Date();
      const lastJoined = row?.lastVoiceJoinedAt ?? null;
      const PER_MIN_REWARD = 2; // per minute in voice

      if (joinedNow) {
        // Ensure Member exists (no increments on join)
        await client.prisma.member.upsert({
          where: { guildId_userId: { guildId, userId } },
          create: { guildId, userId, xp: 0, level: 0, msgCount: 0, voiceSeconds: 0 },
          update: {},
        });
        await client.prisma.economyBalance.upsert({
          where: { guildId_userId: { guildId, userId } },
          create: {
            guildId,
            userId,
            cur1: 0,
            cur2: 0,
            lastVoiceJoinedAt: now
          },
          update: { lastVoiceJoinedAt: now },
        });
        return;
      }

      if ((leftNow || movedNow) && lastJoined) {
        const ms = Math.max(0, now - lastJoined);
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor(ms / 1000);

        // Ignore lists: channels, users, roles (skip accrual if ignored)
        try {
          const [ignCh, ignUsers, ignRoles] = await Promise.all([
            client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Channel' } }),
            client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'User' } }),
            client.prisma.levelingIgnore.findMany({ where: { guildId, kind: 'Role' } }),
          ]);
          const channelId = oldState.channelId || newState.channelId;
          const chIgnored = channelId ? ignCh.some(r => r.targetId === channelId) : false;
          const userIgnored = ignUsers.some(r => r.targetId === userId);
          const memberRoles = (newState.member || oldState.member)?.roles?.cache;
          const roleIgnored = memberRoles ? ignRoles.some(r => memberRoles.has(r.targetId)) : false;
          if (chIgnored || userIgnored || roleIgnored) {
            // Still store raw voiceSeconds for stats, but do not add XP below
            if (seconds > 0) {
              await client.prisma.member.upsert({
                where: { guildId_userId: { guildId, userId } },
                create: { guildId, userId, xp: 0, level: 0, msgCount: 0, voiceSeconds: seconds },
                update: { voiceSeconds: { increment: seconds } },
              });
            }
            lastVoiceJoin.delete(key);
            return;
          }
        } catch {}

        // Always accumulate voice seconds, even if < 1 minute
        if (seconds > 0) {
          await client.prisma.member.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: { guildId, userId, xp: 0, level: 0, msgCount: 0, voiceSeconds: seconds },
            update: { voiceSeconds: { increment: seconds } },
          });
        }

        // Apply voice cooldown (LevelConfig.voiceCooldown): require minimum session length
        let eligibleSeconds = seconds;
        try {
          const cfg = await client.prisma.levelConfig.findUnique({ where: { guildId } });
          const voiceCooldown = cfg?.voiceCooldown ?? 60;
          if (voiceCooldown > 0 && eligibleSeconds < voiceCooldown) {
            eligibleSeconds = 0;
          }
        } catch {}

        // Add leveling EXP for full minutes in voice
        try {
          const { addedXp, newLevel, oldLevel } = await Leveling.addVoiceXp(client, guildId, userId, eligibleSeconds);
          if (addedXp > 0 && newLevel !== null && oldLevel !== null && newLevel > oldLevel) {
            await RoleService.syncLevelRoles(newState.guild || oldState.guild, userId, newLevel, client);
          }
        } catch (e) {
          client.logs?.error?.(`voiceStateUpdate leveling error: ${e.message}`);
        }

        // Economy reward only for full minutes
        if (minutes > 0) {
          const reward = minutes * PER_MIN_REWARD;
          await client.prisma.economyBalance.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: {
              guildId,
              userId,
              cur1: reward,
              cur2: 0,
              lastVoiceJoinedAt: movedNow ? now : null,
            },
            update: { cur1: { increment: reward }, lastVoiceJoinedAt: movedNow ? now : null },
          });
        } else {
          // Just clear the join marker if no full minutes
          await client.prisma.economyBalance.update({
            where: { guildId_userId: { guildId, userId } },
            data: { lastVoiceJoinedAt: movedNow ? now : null },
          }).catch(() => {});
        }
      }
    } catch (e) {
      client.logs?.error?.(`voiceStateUpdate earn error: ${e.message}`);
    }
  }
};

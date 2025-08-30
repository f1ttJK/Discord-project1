// ensureGuildAndUser removed; using connectOrCreate instead

module.exports = {
  event: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    try {
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

        // Always accumulate voice seconds, even if < 1 minute
        if (seconds > 0) {
          await client.prisma.member.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: { guildId, userId, xp: 0, level: 0, msgCount: 0, voiceSeconds: seconds },
            update: { voiceSeconds: { increment: seconds } },
          });
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

// LevelingService
// Implements EXP accrual and level computation per docs/leveling.md
// Functional style, CommonJS module.exports

const DEFAULTS = {
  baseMsgXp: 10,
  msgXpCooldownMs: 60 * 1000,
  baseVoiceXpPerMinute: 5,
};

// In-memory cooldown storage to avoid schema changes initially
// Key: `${guildId}:${userId}`
const lastMsgXpAt = new Map();

/**
 * Compute EXP required to reach `level` from `level-1`.
 * required(level) = 5 * (level - 1)^2 + 50 * (level - 1) + 100
 * level >= 1
 */
const requiredForLevel = (level) => {
  if (level <= 0) return 0;
  const x = level - 1;
  return 5 * x * x + 50 * x + 100;
};

/**
 * Compute level from total XP using the required(level) curve.
 * Starts at 0 and increments while we have enough XP to pay for next level.
 */
const computeLevelFromTotalXp = (totalXp) => {
  let level = 0;
  let remain = Math.max(0, totalXp | 0);
  // Safe guard: cap loop to avoid pathological cases
  for (let i = 0; i < 10000; i++) {
    const need = requiredForLevel(level + 1);
    if (remain >= need) {
      remain -= need;
      level += 1;
    } else break;
  }
  return level;
};

/**
 * Add EXP for a text message with cooldown.
 * Respects message-based cooldown per user per guild.
 * Returns { addedXp, newLevel, oldLevel }
 */
async function addMessageXp(client, guildId, userId, now = new Date(), opts = {}) {
  const baseXp = opts.baseMsgXp ?? DEFAULTS.baseMsgXp;
  const cooldownMs = opts.msgXpCooldownMs ?? DEFAULTS.msgXpCooldownMs;
  const key = `${guildId}:${userId}`;
  const last = lastMsgXpAt.get(key) ?? 0;
  if (now.getTime() - last < cooldownMs) {
    return { addedXp: 0, newLevel: null, oldLevel: null, cooledDown: true };
  }

  // Atomically bump xp and recompute level
  const member = await client.prisma.member.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, xp: baseXp, level: 0, msgCount: 0, voiceSeconds: 0 },
    update: { xp: { increment: baseXp } },
  });

  const totalXp = member.xp + (member._count ? 0 : 0); // xp includes increment already in .update path via returning? Prisma upsert returns previous by default.
  // Re-read to be sure we have fresh xp
  const updated = await client.prisma.member.findUnique({
    where: { guildId_userId: { guildId, userId } },
    select: { xp: true, level: true },
  });

  const oldLevel = updated.level | 0;
  const newLevel = computeLevelFromTotalXp(updated.xp);

  if (newLevel !== oldLevel) {
    await client.prisma.member.update({
      where: { guildId_userId: { guildId, userId } },
      data: { level: newLevel },
    }).catch(() => {});
    // Defer role sync to caller to avoid circular deps; return info instead
  }

  lastMsgXpAt.set(key, now.getTime());

  return { addedXp: baseXp, newLevel, oldLevel };
}

/**
 * Add EXP for voice time.
 * Converts seconds -> full minutes -> EXP. Returns { addedXp, fullMinutes, newLevel, oldLevel }
 */
async function addVoiceXp(client, guildId, userId, seconds, opts = {}) {
  const perMin = opts.baseVoiceXpPerMinute ?? DEFAULTS.baseVoiceXpPerMinute;
  const fullMinutes = Math.floor(Math.max(0, seconds) / 60);
  if (fullMinutes <= 0) {
    return { addedXp: 0, fullMinutes: 0, newLevel: null, oldLevel: null };
  }
  const add = fullMinutes * perMin;

  const member = await client.prisma.member.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, xp: add, level: 0, msgCount: 0, voiceSeconds: seconds | 0 },
    update: { xp: { increment: add } },
  });

  const updated = await client.prisma.member.findUnique({
    where: { guildId_userId: { guildId, userId } },
    select: { xp: true, level: true },
  });

  const oldLevel = updated.level | 0;
  const newLevel = computeLevelFromTotalXp(updated.xp);

  if (newLevel !== oldLevel) {
    await client.prisma.member.update({
      where: { guildId_userId: { guildId, userId } },
      data: { level: newLevel },
    }).catch(() => {});
  }

  return { addedXp: add, fullMinutes, newLevel, oldLevel };
}

module.exports = {
  DEFAULTS,
  requiredForLevel,
  computeLevelFromTotalXp,
  addMessageXp,
  addVoiceXp,
};

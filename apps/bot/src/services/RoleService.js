// Sync level roles for a member based on LevelingRole rules and stacking config.
// - stacking on: grant all roles with minLevel <= level
// - stacking off: grant only the highest role with minLevel <= level (remove others)
async function syncLevelRoles(guild, memberId, level, client) {
  try {
    if (!guild) return;
    const guildId = guild.id;
    const prisma = client?.prisma;

    let stacking = true;
    let rules = [];
    if (!prisma) {
      // API mode
      try {
        const { apiRequest } = require('./ApiClient');
        const data = await apiRequest(`/v1/leveling/${guildId}/roles`);
        stacking = data?.config?.roleStacking !== false;
        rules = Array.isArray(data?.rules) ? data.rules : [];
      } catch (e) {
        client?.logs?.warn?.(`RoleService API fetch failed: ${e.message}`);
        return;
      }
    } else {
      // Prisma mode
      const [cfg, dbRules] = await Promise.all([
        prisma.levelConfig.findUnique({ where: { guildId } }).catch(() => null),
        prisma.levelingRole.findMany({ where: { guildId }, orderBy: { order: 'asc' } }).catch(() => []),
      ]);
      stacking = cfg?.roleStacking !== false;
      rules = dbRules;
    }

    if (!rules.length) return;

    // Compute target role IDs for this level
    const eligible = rules.filter(r => (r.minLevel ?? 1) <= (level ?? 0));
    if (!eligible.length) return;

    const rolesCache = guild.roles?.cache;
    const validIds = (ids) => ids.filter(id => rolesCache?.has?.(id));

    let targetRoleIds = [];
    if (stacking) {
      targetRoleIds = validIds(eligible.map(r => r.roleId));
    } else {
      // Highest by minLevel among eligible
      const best = eligible.reduce((a, b) => (a.minLevel >= b.minLevel ? a : b));
      targetRoleIds = validIds([best.roleId]);
    }

    // Fetch member
    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) return;

    const currentSet = new Set(member.roles.cache.keys());
    const targetSet = new Set(targetRoleIds);

    // Determine changes
    const toAdd = targetRoleIds.filter(id => !currentSet.has(id));
    const toRemove = rules
      .map(r => r.roleId)
      .filter(id => currentSet.has(id) && !targetSet.has(id));

    // Apply changes sequentially (simple rate-limit friendly)
    for (const id of toAdd) {
      try { await member.roles.add(id, 'Leveling: grant'); } catch (e) { client?.logs?.warn?.(`add role ${id} failed: ${e.message}`); }
    }
    for (const id of toRemove) {
      try { await member.roles.remove(id, 'Leveling: revoke'); } catch (e) { client?.logs?.warn?.(`remove role ${id} failed: ${e.message}`); }
    }

    client?.logs?.info?.(
      JSON.stringify({
        level: 'info',
        ts: new Date().toISOString(),
        operation: 'role-sync',
        guildId,
        userId: memberId,
        stacking,
        level,
        addCount: toAdd.length,
        removeCount: toRemove.length,
      })
    );
  } catch (e) {
    client?.logs?.error?.(`RoleService.syncLevelRoles error: ${e.message}`);
  }
}

module.exports = { syncLevelRoles };

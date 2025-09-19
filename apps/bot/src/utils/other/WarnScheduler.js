// Periodic tasks for warn system: cleanup expired warns
module.exports = (client) => {
  if (process.env.USE_API_DB === 'true') {
    client.logs.system('WarnScheduler disabled (USE_API_DB=true)');
    return;
  }
  // Run every hour
  const intervalMs = 60 * 60 * 1000;

  const tick = async () => {
    try {
      const now = new Date();
      // Delete warns with expiresAt <= now
      const res = await client.prisma.warn.deleteMany({
        where: { expiresAt: { lte: now } }
      });
      if (res.count > 0) client.logs.database(`Warn cleanup removed ${res.count} expired warns`);
    } catch (e) {
      client.logs.warn(`Warn cleanup error: ${e.message}`);
    }
  };

  // First tick delayed a bit after startup, then schedule
  setTimeout(() => {
    tick();
    setInterval(tick, intervalMs).unref();
  }, 15 * 1000).unref();
};

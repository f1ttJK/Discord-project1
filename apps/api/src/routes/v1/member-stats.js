"use strict";

const { requireAuth } = require("../../middlewares/auth");

/**
 * Member stats endpoints
 * GET /v1/guilds/:guildId/members/:userId/level -> { xp, level }
 */
async function memberStatsRoutes(fastify) {

  fastify.get("/guilds/:guildId/members/:userId/level", {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { guildId, userId } = request.params;
    // API-only mode: we don't have persistent store here.
    // Return safe defaults; leveling accrual endpoints maintain their own in-memory state.
    // If you need to reflect real XP/level here, wire to the same in-memory used by leveling routes.
    return { xp: 0, level: 0 };
  });
}

module.exports = memberStatsRoutes;

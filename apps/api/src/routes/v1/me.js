"use strict";

const { requireAuth } = require("../../middlewares/auth");
const { getPrisma } = require("../../repos/prisma");

/**
 * /v1/me route: returns current user and linked providers metadata
 * @param {import('fastify').FastifyInstance} fastify
 */
async function meRoutes(fastify) {
  const prisma = getPrisma();

  fastify.get("/me", { preHandler: [requireAuth] }, async (request) => {
    const userId = request.auth.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        oauthAccounts: {
          select: {
            provider: true,
            scope: true,
            expiresAt: true,
          },
        },
      },
    });

    return { user };
  });
}

module.exports = meRoutes;

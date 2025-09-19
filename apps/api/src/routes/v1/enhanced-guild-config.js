"use strict";

const { requireAuth } = require("../../middlewares/auth");
// Remove these imports since they're now handled by plugins
const { GuildParamsSchema, GuildConfigUpdateSchema } = require("../../schemas/requests");
const { getDiscordAccessToken } = require("../../repos/oauth");
const { discordRequest, canManageGuild } = require("../../utils/discord");
const { GuildConfigSchema } = require("../../schemas/guildConfig");
const { ensureGuild, getGuildConfig, upsertGuildConfig } = require("../../repos/guilds");
const { cache } = require("../../utils/cache");
const { requestQueue } = require("../../utils/requestQueue");
const { databaseBreaker } = require("../../utils/circuitBreaker");

async function ensureManageGuildPermission(userId, guildId, logger) {
  const cacheKey = `guilds:${userId}`;
  
  try {
    // Try to get guilds from cache first
    let guilds = cache.get(cacheKey);
    
    if (!guilds) {
      const token = await getDiscordAccessToken(userId);
      if (!token) {
        logger.warn({ userId, guildId }, 'no_discord_token');
        return { ok: false, code: "NO_DISCORD_TOKEN" };
      }
      
      const { status, data, error } = await discordRequest("/users/@me/guilds", { accessToken: token });
      if (status >= 400 || !Array.isArray(data)) {
        logger.warn({ userId, guildId, status, error }, 'discord_upstream_error');
        return { ok: false, code: "DISCORD_UPSTREAM_ERROR" };
      }
      
      guilds = data;
      // Cache for 60 seconds
      cache.set(cacheKey, guilds, 60000);
      logger.debug({ userId, guildCount: guilds.length }, 'guilds_cached');
    }
    
    const g = guilds.find(x => x.id === guildId);
    if (!g) {
      logger.warn({ userId, guildId }, 'user_not_in_guild');
      return { ok: false, code: "NOT_IN_GUILD" };
    }
    
    if (!canManageGuild(g.permissions)) {
      logger.warn({ userId, guildId, permissions: g.permissions }, 'insufficient_permissions');
      return { ok: false, code: "FORBIDDEN" };
    }
    
    logger.debug({ userId, guildId }, 'permission_check_passed');
    return { ok: true };
  } catch (error) {
    logger.error({ err: error, userId, guildId }, 'permission_check_error');
    return { ok: false, code: "INTERNAL_ERROR" };
  }
}

/**
 * Enhanced Guild config routes with proper validation, logging, and error handling
 */
async function enhancedGuildConfigRoutes(fastify) {
  // Middlewares are now handled globally by plugins

  // GET /v1/guilds/:guildId/config - Enhanced with validation and caching
  fastify.get("/guilds/:guildId/config", {
    preHandler: [requireAuth]
  }, async (request, reply) => {
    const userId = request.auth.userId;
    const { guildId } = request.params;
    const cacheKey = `guild-config:${guildId}`;

    request.log.info({ operation: 'get_guild_config', guildId }, 'config_request_start');

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      request.log.debug({ guildId }, 'config_cache_hit');
      return { config: cached, cached: true };
    }

    return requestQueue.execute(cacheKey, async () => {
      // Double-check cache after queue
      const cached = cache.get(cacheKey);
      if (cached) {
        request.log.debug({ guildId }, 'config_cache_hit_after_queue');
        return { config: cached, cached: true };
      }

      // Permission check for non-service requests
      if (!request.auth?.service) {
        const perm = await ensureManageGuildPermission(userId, guildId, request.log);
        if (!perm.ok) {
          const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
          return reply.code(status).send({ 
            error: { 
              message: perm.code, 
              code: perm.code,
              status
            } 
          });
        }
      }

      // Database operation with circuit breaker
      const config = await databaseBreaker.execute(async () => {
        await ensureGuild(guildId);
        return await getGuildConfig(guildId);
      });
      
      // Cache for 30 seconds
      cache.set(cacheKey, config, 30000);
      request.log.info({ guildId, configKeys: Object.keys(config) }, 'config_loaded_successfully');
      
      return { config, cached: false };
    });
  });

  // PUT /v1/guilds/:guildId/config - Enhanced with validation and audit logging
  fastify.put("/guilds/:guildId/config", {
    preHandler: [requireAuth]
  }, async (request, reply) => {
    const userId = request.auth.userId;
    const { guildId } = request.params;
    const updateData = request.body;

    request.log.info({ 
      operation: 'update_guild_config', 
      guildId, 
      updateKeys: Object.keys(updateData) 
    }, 'config_update_start');

    // Permission check for non-service requests
    if (!request.auth?.service) {
      const perm = await ensureManageGuildPermission(userId, guildId, request.log);
      if (!perm.ok) {
        const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
        return reply.code(status).send({ 
          error: { 
            message: perm.code, 
            code: perm.code,
            status
          } 
        });
      }
    }

    // Validate with full schema
    const fullValidation = GuildConfigSchema.safeParse(updateData);
    if (!fullValidation.success) {
      request.log.warn({ 
        guildId, 
        validationErrors: fullValidation.error.flatten() 
      }, 'config_validation_failed');
      
      return reply.code(400).send({ 
        error: { 
          message: "Invalid configuration", 
          code: "VALIDATION_ERROR", 
          status: 400,
          details: fullValidation.error.flatten() 
        } 
      });
    }

    try {
      // Database operations with circuit breaker
      const updated = await databaseBreaker.execute(async () => {
        await ensureGuild(guildId);
        return await upsertGuildConfig(guildId, fullValidation.data);
      });
      
      // Invalidate cache after update
      const cacheKey = `guild-config:${guildId}`;
      cache.delete(cacheKey);
      
      request.log.info({ 
        guildId, 
        updatedKeys: Object.keys(updateData),
        userId 
      }, 'config_updated_successfully');
      
      return { 
        config: updated, 
        updated: true,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      request.log.error({ 
        err: error, 
        guildId, 
        userId,
        operation: 'config_update'
      }, 'config_update_failed');
      
      return reply.code(500).send({
        error: {
          message: "Failed to update configuration",
          code: "UPDATE_FAILED",
          status: 500
        }
      });
    }
  });

  // GET /v1/guilds/:guildId - Enhanced guild info endpoint
  fastify.get("/guilds/:guildId", {
    preHandler: [requireAuth]
  }, async (request, reply) => {
    const userId = request.auth.userId;
    const { guildId } = request.params;

    request.log.info({ operation: 'get_guild_info', guildId }, 'guild_info_request');

    // Permission check for non-service requests
    if (!request.auth?.service) {
      const perm = await ensureManageGuildPermission(userId, guildId, request.log);
      if (!perm.ok) {
        const status = perm.code === "FORBIDDEN" ? 403 : perm.code === "NOT_IN_GUILD" ? 404 : 401;
        return reply.code(status).send({ 
          error: { 
            message: perm.code, 
            code: perm.code,
            status
          } 
        });
      }
    }

    try {
      const guild = await databaseBreaker.execute(async () => {
        return await ensureGuild(guildId);
      });
      
      request.log.info({ guildId }, 'guild_info_retrieved');
      
      return { 
        guild: { 
          id: guild.id, 
          createdAt: guild.createdAt,
          updatedAt: guild.updatedAt
        } 
      };
      
    } catch (error) {
      request.log.error({ err: error, guildId }, 'guild_info_failed');
      
      return reply.code(500).send({
        error: {
          message: "Failed to retrieve guild information",
          code: "GUILD_INFO_FAILED",
          status: 500
        }
      });
    }
  });
}

module.exports = enhancedGuildConfigRoutes;

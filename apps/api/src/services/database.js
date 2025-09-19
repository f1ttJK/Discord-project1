"use strict";

const DatabaseOptimizer = require('../utils/database');

/**
 * Database service with optimized queries and caching
 */
class DatabaseService {
  constructor(prismaClient) {
    this.optimizer = new DatabaseOptimizer(prismaClient);
    this.prisma = prismaClient;
  }

  /**
   * Get or create guild with optimized query
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Guild record
   */
  async ensureGuild(guildId) {
    return this.optimizer.executeQuery(
      'ensureGuild',
      async () => {
        return await this.prisma.guild.upsert({
          where: { id: guildId },
          update: { updatedAt: new Date() },
          create: { 
            id: guildId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      },
      {
        cacheKey: `guild:${guildId}`,
        cacheTTL: 300000, // 5 minutes
        enableCache: true
      }
    );
  }

  /**
   * Get guild configuration with all related settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Complete guild configuration
   */
  async getGuildConfig(guildId) {
    const config = await this.optimizer.getGuildConfig(guildId);
    
    if (!config) {
      // Create default config if none exists
      return await this.createDefaultGuildConfig(guildId);
    }
    
    return config;
  }

  /**
   * Create default guild configuration
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Default configuration
   */
  async createDefaultGuildConfig(guildId) {
    const defaultConfig = {
      guildId,
      levelingEnabled: false,
      warnsEnabled: true,
      muteEnabled: true,
      economyEnabled: false,
      maxWarns: 3,
      warnExpiry: 0,
      muteRole: null,
      maxMuteDuration: 86400,
      dailyReward: 100,
      workReward: 50,
      language: 'en',
      timezone: null,
      logChannel: null,
      welcomeChannel: null,
      welcomeMessage: null,
      curve: 'linear'
    };

    return this.optimizer.executeQuery(
      'createDefaultGuildConfig',
      async () => {
        return await this.prisma.guildConfig.create({
          data: defaultConfig
        });
      },
      {
        cacheKey: `guild-config:${guildId}`,
        cacheTTL: 60000,
        enableCache: true
      }
    );
  }

  /**
   * Update guild configuration with validation and caching
   * @param {string} guildId - Guild ID
   * @param {Object} updates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateGuildConfig(guildId, updates) {
    // Ensure guild exists first
    await this.ensureGuild(guildId);

    return this.optimizer.executeQuery(
      'updateGuildConfig',
      async () => {
        const updated = await this.prisma.guildConfig.upsert({
          where: { guildId },
          update: {
            ...updates,
            updatedAt: new Date()
          },
          create: {
            guildId,
            ...updates,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        // Invalidate related caches
        this.optimizer.queryCache.delete(`guild-config:${guildId}`);
        this.optimizer.queryCache.deletePattern(`leaderboard:${guildId}:*`);

        return updated;
      },
      {
        enableCache: false
      }
    );
  }

  /**
   * Get user leveling data with rank calculation
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} User leveling data with rank
   */
  async getUserLevelingWithRank(userId, guildId) {
    const userLevel = await this.optimizer.getUserLeveling(userId, guildId);
    
    if (!userLevel) {
      return null;
    }

    // Calculate user rank efficiently
    const rank = await this.optimizer.executeQuery(
      'getUserRank',
      async () => {
        const result = await this.prisma.userLevel.count({
          where: {
            guildId,
            OR: [
              { level: { gt: userLevel.level } },
              {
                level: userLevel.level,
                xp: { gt: userLevel.xp }
              }
            ]
          }
        });
        return result + 1; // Add 1 because count returns users above current user
      },
      {
        cacheKey: `user-rank:${userId}:${guildId}`,
        cacheTTL: 30000,
        enableCache: true
      }
    );

    return {
      ...userLevel,
      rank
    };
  }

  /**
   * Add XP to user with level calculation and caching
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {number} xpGain - XP to add
   * @returns {Promise<Object>} Updated user level data
   */
  async addUserXP(userId, guildId, xpGain) {
    return this.optimizer.executeQuery(
      'addUserXP',
      async () => {
        // Get current user level
        let userLevel = await this.prisma.userLevel.findUnique({
          where: {
            userId_guildId: { userId, guildId }
          }
        });

        if (!userLevel) {
          // Create new user level record
          userLevel = await this.prisma.userLevel.create({
            data: {
              userId,
              guildId,
              xp: xpGain,
              level: 1,
              lastActivity: new Date()
            }
          });
        } else {
          // Update existing record
          const newXP = userLevel.xp + xpGain;
          const newLevel = this.calculateLevel(newXP);
          const leveledUp = newLevel > userLevel.level;

          userLevel = await this.prisma.userLevel.update({
            where: {
              userId_guildId: { userId, guildId }
            },
            data: {
              xp: newXP,
              level: newLevel,
              lastActivity: new Date()
            }
          });

          userLevel.leveledUp = leveledUp;
        }

        // Invalidate related caches
        this.optimizer.queryCache.delete(`user-level:${userId}:${guildId}`);
        this.optimizer.queryCache.delete(`user-rank:${userId}:${guildId}`);
        this.optimizer.queryCache.deletePattern(`leaderboard:${guildId}:*`);

        return userLevel;
      },
      {
        enableCache: false
      }
    );
  }

  /**
   * Calculate level from XP using configurable curve
   * @param {number} xp - Total XP
   * @param {string} curve - Curve type (linear, exponential, logarithmic)
   * @returns {number} Level
   */
  calculateLevel(xp, curve = 'linear') {
    if (xp < 0) return 1;

    switch (curve) {
      case 'exponential':
        return Math.floor(Math.sqrt(xp / 100)) + 1;
      case 'logarithmic':
        return Math.floor(Math.log2(xp / 50 + 1)) + 1;
      case 'linear':
      default:
        return Math.floor(xp / 1000) + 1;
    }
  }

  /**
   * Get user warns with pagination
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {Object} options - Pagination and filtering options
   * @returns {Promise<Object>} Warns data with pagination
   */
  async getUserWarns(userId, guildId, options = {}) {
    const { page = 0, limit = 10, includeExpired = false } = options;
    const offset = page * limit;

    return this.optimizer.executeQuery(
      'getUserWarns',
      async () => {
        const where = {
          userId,
          guildId,
          ...(includeExpired ? {} : {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          })
        };

        const [warns, total] = await Promise.all([
          this.prisma.userWarn.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
            include: {
              moderator: {
                select: {
                  id: true,
                  username: true,
                  discriminator: true
                }
              }
            }
          }),
          this.prisma.userWarn.count({ where })
        ]);

        return {
          warns,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        };
      },
      {
        cacheKey: `user-warns:${userId}:${guildId}:${page}:${limit}:${includeExpired}`,
        cacheTTL: 60000,
        enableCache: true
      }
    );
  }

  /**
   * Add warn to user with escalation check
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {string} moderatorId - Moderator ID
   * @param {string} reason - Warn reason
   * @param {Date} expiresAt - Optional expiration date
   * @returns {Promise<Object>} Warn data with escalation info
   */
  async addUserWarn(userId, guildId, moderatorId, reason, expiresAt = null) {
    return this.optimizer.executeQuery(
      'addUserWarn',
      async () => {
        // Create the warn
        const warn = await this.prisma.userWarn.create({
          data: {
            userId,
            guildId,
            moderatorId,
            reason,
            expiresAt,
            createdAt: new Date()
          }
        });

        // Check for escalation
        const activeWarns = await this.prisma.userWarn.count({
          where: {
            userId,
            guildId,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        });

        // Get guild config for max warns
        const guildConfig = await this.getGuildConfig(guildId);
        const shouldEscalate = activeWarns >= guildConfig.maxWarns;

        // Invalidate caches
        this.optimizer.queryCache.deletePattern(`user-warns:${userId}:${guildId}:*`);

        return {
          warn,
          activeWarns,
          shouldEscalate,
          maxWarns: guildConfig.maxWarns
        };
      },
      {
        enableCache: false
      }
    );
  }

  /**
   * Get database performance statistics
   * @returns {Promise<Object>} Performance statistics
   */
  async getPerformanceStats() {
    const [connectionStats, performanceStats] = await Promise.all([
      this.optimizer.getConnectionStats(),
      Promise.resolve(this.optimizer.getPerformanceStats())
    ]);

    return {
      connections: connectionStats,
      performance: performanceStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Perform database maintenance tasks
   * @returns {Promise<Object>} Maintenance results
   */
  async performMaintenance() {
    return this.optimizer.performMaintenance();
  }
}

module.exports = DatabaseService;

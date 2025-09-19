"use strict";

const { circuitBreakers } = require('./circuitBreaker');
const cache = require('./cache');

/**
 * Database optimization utilities with connection pooling, query optimization, and caching
 */
class DatabaseOptimizer {
  constructor(prismaClient) {
    this.prisma = prismaClient;
    this.queryCache = cache;
    this.slowQueryThreshold = 1000; // ms
    this.connectionPool = {
      maxConnections: 10,
      idleTimeout: 30000,
      connectionTimeout: 5000
    };
  }

  /**
   * Execute a query with circuit breaker protection and performance monitoring
   * @param {string} operation - Operation name for logging
   * @param {Function} queryFn - Function that returns a promise with the query
   * @param {Object} options - Options for caching and optimization
   * @returns {Promise<any>} Query result
   */
  async executeQuery(operation, queryFn, options = {}) {
    const {
      cacheKey = null,
      cacheTTL = 30000,
      enableCache = true,
      timeout = 10000
    } = options;

    const startTime = process.hrtime.bigint();
    
    try {
      // Check cache first if enabled
      if (enableCache && cacheKey) {
        const cached = this.queryCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Execute query with circuit breaker protection
      const result = await circuitBreakers.database.execute(async () => {
        return await Promise.race([
          queryFn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), timeout)
          )
        ]);
      });

      // Calculate execution time
      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1e6; // Convert to ms

      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        console.warn(`Slow query detected: ${operation} took ${executionTime.toFixed(2)}ms`);
      }

      // Cache result if enabled
      if (enableCache && cacheKey && result) {
        this.queryCache.set(cacheKey, result, cacheTTL);
      }

      return result;
    } catch (error) {
      console.error(`Database query failed: ${operation}`, error);
      throw error;
    }
  }

  /**
   * Optimized guild config retrieval with caching and indexing hints
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Guild configuration
   */
  async getGuildConfig(guildId) {
    return this.executeQuery(
      'getGuildConfig',
      async () => {
        return await this.prisma.guildConfig.findUnique({
          where: { guildId },
          // Include related data efficiently
          include: {
            levelingConfig: true,
            moderationConfig: true,
            economyConfig: true
          }
        });
      },
      {
        cacheKey: `guild-config:${guildId}`,
        cacheTTL: 60000, // 1 minute
        enableCache: true
      }
    );
  }

  /**
   * Batch update guild configurations for multiple guilds
   * @param {Array} updates - Array of {guildId, config} objects
   * @returns {Promise<Array>} Updated configurations
   */
  async batchUpdateGuildConfigs(updates) {
    return this.executeQuery(
      'batchUpdateGuildConfigs',
      async () => {
        const results = [];
        
        // Use transaction for atomicity
        await this.prisma.$transaction(async (tx) => {
          for (const { guildId, config } of updates) {
            const updated = await tx.guildConfig.upsert({
              where: { guildId },
              update: config,
              create: { guildId, ...config }
            });
            results.push(updated);
            
            // Invalidate cache
            this.queryCache.delete(`guild-config:${guildId}`);
          }
        });
        
        return results;
      },
      {
        enableCache: false,
        timeout: 30000 // Longer timeout for batch operations
      }
    );
  }

  /**
   * Get user leveling data with optimized queries
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} User leveling data
   */
  async getUserLeveling(userId, guildId) {
    return this.executeQuery(
      'getUserLeveling',
      async () => {
        return await this.prisma.userLevel.findUnique({
          where: {
            userId_guildId: {
              userId,
              guildId
            }
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                avatar: true
              }
            }
          }
        });
      },
      {
        cacheKey: `user-level:${userId}:${guildId}`,
        cacheTTL: 30000,
        enableCache: true
      }
    );
  }

  /**
   * Get guild leaderboard with pagination and caching
   * @param {string} guildId - Guild ID
   * @param {number} page - Page number (0-based)
   * @param {number} limit - Items per page
   * @returns {Promise<Object>} Leaderboard data
   */
  async getGuildLeaderboard(guildId, page = 0, limit = 10) {
    const offset = page * limit;
    
    return this.executeQuery(
      'getGuildLeaderboard',
      async () => {
        const [users, total] = await Promise.all([
          this.prisma.userLevel.findMany({
            where: { guildId },
            orderBy: [
              { level: 'desc' },
              { xp: 'desc' }
            ],
            skip: offset,
            take: limit,
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  discriminator: true,
                  avatar: true
                }
              }
            }
          }),
          this.prisma.userLevel.count({
            where: { guildId }
          })
        ]);

        return {
          users,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        };
      },
      {
        cacheKey: `leaderboard:${guildId}:${page}:${limit}`,
        cacheTTL: 120000, // 2 minutes
        enableCache: true
      }
    );
  }

  /**
   * Bulk insert user experience updates
   * @param {Array} updates - Array of {userId, guildId, xpGain} objects
   * @returns {Promise<void>}
   */
  async bulkUpdateUserXP(updates) {
    return this.executeQuery(
      'bulkUpdateUserXP',
      async () => {
        // Group updates by guild for better performance
        const updatesByGuild = updates.reduce((acc, update) => {
          if (!acc[update.guildId]) acc[update.guildId] = [];
          acc[update.guildId].push(update);
          return acc;
        }, {});

        await this.prisma.$transaction(async (tx) => {
          for (const [guildId, guildUpdates] of Object.entries(updatesByGuild)) {
            for (const { userId, xpGain } of guildUpdates) {
              await tx.userLevel.upsert({
                where: {
                  userId_guildId: { userId, guildId }
                },
                update: {
                  xp: { increment: xpGain },
                  lastActivity: new Date()
                },
                create: {
                  userId,
                  guildId,
                  xp: xpGain,
                  level: 1,
                  lastActivity: new Date()
                }
              });

              // Invalidate user cache
              this.queryCache.delete(`user-level:${userId}:${guildId}`);
            }
            
            // Invalidate leaderboard cache for this guild
            this.queryCache.deletePattern(`leaderboard:${guildId}:*`);
          }
        });
      },
      {
        enableCache: false,
        timeout: 60000 // Longer timeout for bulk operations
      }
    );
  }

  /**
   * Clean up expired data and optimize database
   * @returns {Promise<Object>} Cleanup statistics
   */
  async performMaintenance() {
    return this.executeQuery(
      'performMaintenance',
      async () => {
        const stats = {
          expiredWarns: 0,
          expiredMutes: 0,
          expiredBans: 0,
          optimizedTables: 0
        };

        await this.prisma.$transaction(async (tx) => {
          // Clean up expired warns
          const expiredWarns = await tx.userWarn.deleteMany({
            where: {
              expiresAt: {
                lte: new Date()
              }
            }
          });
          stats.expiredWarns = expiredWarns.count;

          // Clean up expired mutes
          const expiredMutes = await tx.userMute.deleteMany({
            where: {
              expiresAt: {
                lte: new Date()
              }
            }
          });
          stats.expiredMutes = expiredMutes.count;

          // Clean up old audit logs (older than 90 days)
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          
          await tx.auditLog.deleteMany({
            where: {
              createdAt: {
                lte: ninetyDaysAgo
              }
            }
          });
        });

        // Clear related caches
        this.queryCache.clear();

        return stats;
      },
      {
        enableCache: false,
        timeout: 120000 // 2 minutes for maintenance
      }
    );
  }

  /**
   * Get database connection statistics
   * @returns {Promise<Object>} Connection stats
   */
  async getConnectionStats() {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_connections,
          COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
          COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      return result[0] || { total_connections: 0, active_connections: 0, idle_connections: 0 };
    } catch (error) {
      console.warn('Could not retrieve connection stats:', error.message);
      return { total_connections: 0, active_connections: 0, idle_connections: 0 };
    }
  }

  /**
   * Get query performance statistics
   * @returns {Object} Performance stats
   */
  getPerformanceStats() {
    return {
      cacheStats: this.queryCache.getStats(),
      circuitBreakerStats: circuitBreakers.database.getStats(),
      slowQueryThreshold: this.slowQueryThreshold
    };
  }
}

module.exports = DatabaseOptimizer;

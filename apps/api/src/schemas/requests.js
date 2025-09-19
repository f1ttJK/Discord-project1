"use strict";

const { z } = require("zod");

// Common validation schemas
const GuildIdSchema = z.string().regex(/^\d{17,19}$/, "Invalid Discord guild ID");
const UserIdSchema = z.string().regex(/^\d{17,19}$/, "Invalid Discord user ID");

// Pagination schemas
const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().optional()
});

const SortQuerySchema = z.object({
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'level', 'xp']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Guild routes schemas
const GuildParamsSchema = z.object({
  guildId: GuildIdSchema
});

const GuildConfigUpdateSchema = z.object({
  levelingEnabled: z.boolean().optional(),
  warnsEnabled: z.boolean().optional(),
  muteEnabled: z.boolean().optional(),
  economyEnabled: z.boolean().optional(),
  maxWarns: z.number().int().min(1).max(10).optional(),
  warnExpiry: z.number().int().min(0).optional(),
  muteRole: z.string().optional(),
  maxMuteDuration: z.number().int().min(60).max(2592000).optional(), // 1 min to 30 days
  dailyReward: z.number().int().min(1).max(1000).optional(),
  workReward: z.number().int().min(1).max(1000).optional(),
  language: z.enum(['en', 'ru', 'es', 'fr', 'de']).default('en').optional(),
  timezone: z.string().optional(),
  logChannel: z.string().optional(),
  welcomeChannel: z.string().optional(),
  welcomeMessage: z.string().max(2000).optional(),
  curve: z.enum(['linear', 'exponential', 'logarithmic']).default('linear').optional()
});

// Leveling schemas
const LevelingParamsSchema = z.object({
  guildId: GuildIdSchema,
  userId: UserIdSchema.optional()
});

const LeaderboardQuerySchema = PaginationQuerySchema.extend({
  timeframe: z.enum(['all', 'week', 'month']).default('all')
});

// Audit log schemas
const AuditLogQuerySchema = PaginationQuerySchema.extend({
  type: z.enum(['config_update', 'level_change', 'warn_issued', 'mute_applied']).optional(),
  userId: UserIdSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
}).extend(SortQuerySchema.shape);

// Warns schemas
const WarnParamsSchema = z.object({
  guildId: GuildIdSchema,
  warnId: z.string().uuid().optional(),
  userId: UserIdSchema.optional()
});

const CreateWarnSchema = z.object({
  userId: UserIdSchema,
  reason: z.string().min(1).max(500),
  moderatorId: UserIdSchema,
  expiresAt: z.coerce.date().optional()
});

const UpdateWarnSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  active: z.boolean().optional()
});

// Headers validation
const ApiVersionHeaderSchema = z.object({
  'accept-version': z.enum(['v1']).default('v1').optional(),
  'content-type': z.string().optional(),
  'user-agent': z.string().optional()
});

// Rate limiting schemas
const RateLimitHeaderSchema = z.object({
  'x-forwarded-for': z.string().optional(),
  'cf-connecting-ip': z.string().optional()
});

module.exports = {
  // Common
  GuildIdSchema,
  UserIdSchema,
  PaginationQuerySchema,
  SortQuerySchema,
  ApiVersionHeaderSchema,
  RateLimitHeaderSchema,
  
  // Guild
  GuildParamsSchema,
  GuildConfigUpdateSchema,
  
  // Leveling
  LevelingParamsSchema,
  LeaderboardQuerySchema,
  
  // Audit
  AuditLogQuerySchema,
  
  // Warns
  WarnParamsSchema,
  CreateWarnSchema,
  UpdateWarnSchema
};

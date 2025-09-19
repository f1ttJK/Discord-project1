"use strict";

const { z } = require("zod");

// Extended schema to match Discord bot settings categories
const GuildConfigSchema = z.object({
  // Leveling system
  levelingEnabled: z.boolean().default(true),
  curve: z.enum(["linear", "exponential", "logarithmic"]).default("linear"),
  antiAbuse: z.any().optional(), // placeholder; later refine to object schema
  roleRewards: z.any().optional(), // placeholder; later refine mapping
  
  // Warning system
  warnsEnabled: z.boolean().default(true),
  maxWarns: z.number().int().min(1).max(10).default(3),
  warnExpiry: z.number().int().min(0).default(0), // 0 = never expire
  
  // Mute system
  muteEnabled: z.boolean().default(true),
  muteRole: z.string().optional(), // role ID for muted users
  maxMuteDuration: z.number().int().min(0).default(86400), // seconds, 0 = unlimited
  
  // Economy system
  economyEnabled: z.boolean().default(false),
  dailyReward: z.number().int().min(0).default(100),
  workReward: z.object({
    min: z.number().int().min(0).default(50),
    max: z.number().int().min(0).default(200)
  }).default({ min: 50, max: 200 }),
  
  // General settings
  locale: z.string().min(2).max(10).default("ru"),
  timezone: z.string().default("Europe/Moscow"),
  logChannel: z.string().optional(), // channel ID for logs
  welcomeEnabled: z.boolean().default(false),
  welcomeChannel: z.string().optional(),
  welcomeMessage: z.string().max(2000).optional(),
});

module.exports = { GuildConfigSchema };

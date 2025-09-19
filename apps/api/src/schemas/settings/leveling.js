"use strict";

const { z } = require("zod");

// Basic leveling settings; align with docs/leveling.md later
const LevelingSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  curve: z.enum(["linear", "custom"]).default("linear"),
  xpPerMessageMin: z.number().int().min(0).default(5),
  xpPerMessageMax: z.number().int().min(0).default(15),
  messageCooldownSec: z.number().int().min(0).default(60),
  voiceXpPerMinute: z.number().int().min(0).default(2),
  voiceCooldownSec: z.number().int().min(0).default(60),
  roleRewards: z.array(z.object({ level: z.number().int().min(1), roleId: z.string() })).default([]),
  ignoreChannels: z.array(z.string()).default([]),
  ignoreRoles: z.array(z.string()).default([]),
  ignoreUsers: z.array(z.string()).default([]),
});

module.exports = { LevelingSettingsSchema };

"use strict";

const { z } = require("zod");

// Basic warns settings; extend/specify further as needed
const WarnsSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  // escalation rules example: [{count: 3, action: 'mute', durationMinutes: 60}]
  escalation: z.array(z.object({
    count: z.number().int().min(1),
    action: z.enum(["mute", "kick", "ban", "none"]).default("none"),
    durationMinutes: z.number().int().min(0).optional(),
  })).default([]),
  dmNotify: z.boolean().default(true),
  auditChannelId: z.string().optional(),
});

module.exports = { WarnsSettingsSchema };

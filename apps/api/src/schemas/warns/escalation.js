"use strict";

const { z } = require("zod");

const WarnActionEnum = z.enum(["none", "mute", "kick", "ban"]);

const WarnEscalationRuleSchema = z.object({
  count: z.number().int().min(1),
  action: WarnActionEnum,
  durationMinutes: z.number().int().min(1).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

module.exports = { WarnEscalationRuleSchema, WarnActionEnum };

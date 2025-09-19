"use strict";

const { z } = require("zod");

const EconomySettingsSchema = z.object({
  enabled: z.boolean().default(true),
  basePrice: z.number().finite().min(0).default(100),
  slope: z.number().finite().min(0).default(0.001),
});

module.exports = { EconomySettingsSchema };

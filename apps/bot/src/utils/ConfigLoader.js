"use strict";

/**
 * Load configuration from environment variables with fallbacks to config.json
 * This ensures sensitive data like tokens come from .env, not hardcoded files
 */
function loadConfig() {
  const config = require('../config/config.json');
  
  // Override with environment variables (secure approach)
  return {
    token: process.env.DISCORD_TOKEN || config.token,
    botID: process.env.BOT_ID || config.botID,
    developerIds: config.developerIds || [],
    devGuild: process.env.DEV_GUILD_ID || config.devGuild,
    sqliteFileName: config.sqliteFileName || "database.sqlite",
    
    // API configuration
    useApiDb: process.env.USE_API_DB === 'true',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
    apiServiceToken: process.env.API_SERVICE_TOKEN,
    
    // Environment
    isDevelopment: process.env.NODE_ENV === 'development'
  };
}

module.exports = { loadConfig };

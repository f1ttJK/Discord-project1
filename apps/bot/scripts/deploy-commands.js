#!/usr/bin/env node
"use strict";

require('dotenv').config();
const { loadConfig } = require('../src/utils/ConfigLoader.js');
const CommandDeployer = require('../src/utils/CommandDeployer.js');

async function main() {
  try {
    const config = loadConfig();
    
    // Validate required config
    if (!config.token || !config.botID) {
      console.error('❌ Missing DISCORD_TOKEN or BOT_ID in environment variables');
      process.exit(1);
    }

    // Create mock client object for deployer
    const mockClient = {
      config,
      logs: {
        system: console.log,
        success: console.log,
        warn: console.warn,
        error: console.error,
        command: console.log
      }
    };

    const deployer = new CommandDeployer(mockClient);
    await deployer.deployCommands();
    
    console.log('✅ Command deployment completed successfully');
  } catch (error) {
    console.error('❌ Command deployment failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

let config;
try {
    // Adjusted path for src directory
    config = require('../../config.json');
} catch (error) {
    console.error('Config file not found or invalid');
    process.exit(1);
}

async function setupDatabase(client) {
  try {
    if (!process.env.DATABASE_URL) {
      if (config?.sqliteFileName) {
        // Use the same filename as earlier, placed at project root
        process.env.DATABASE_URL = `file:./${config.sqliteFileName}`;
        client.logs.database(`DATABASE_URL not set. Using config sqliteFileName -> ${process.env.DATABASE_URL}`);
      } else {
        client.logs.warn('No DATABASE_URL in .env and no sqliteFileName in config.json; Prisma may fail to connect');
      }
    }

    // Initialize Prisma Client
    client.prisma = new PrismaClient();
    await client.prisma.$connect();
    client.logs.database('Prisma connected to database');

    // Graceful shutdown
    const disconnect = async () => {
      try {
        await client.prisma?.$disconnect();
        client.logs.database('Prisma disconnected');
      } catch (e) {
        client.logs.error(`Error during Prisma disconnect: ${e.message}`);
      }
    };

    process.on('beforeExit', disconnect);
    process.on('SIGINT', async () => { await disconnect(); process.exit(0); });
    process.on('SIGTERM', async () => { await disconnect(); process.exit(0); });

    return true;
  } catch (error) {
    client.logs.error(`Error setting up Prisma: ${error.message}`);
    return false;
  }
}

module.exports = { setupDatabase };

-- CreateTable
CREATE TABLE "Guild" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "msgCount" INTEGER NOT NULL DEFAULT 0,
    "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommandLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT,
    "userId" TEXT,
    "command" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommandLog_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommandLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LevelConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "role_stacking" BOOLEAN NOT NULL DEFAULT true,
    "voice_cooldown" INTEGER NOT NULL DEFAULT 60,
    CONSTRAINT "LevelConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EconomyBalance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cur1" INTEGER NOT NULL DEFAULT 0,
    "cur2" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "lastDailyAt" DATETIME,
    "lastWeeklyAt" DATETIME,
    "lastMsgEarnAt" DATETIME,
    "lastVoiceJoinedAt" DATETIME,
    CONSTRAINT "EconomyBalance_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EconomyBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EconomyConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "basePrice" INTEGER NOT NULL DEFAULT 100,
    "slope" REAL NOT NULL DEFAULT 0.001,
    CONSTRAINT "EconomyConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "Warn_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarnConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "logChannelId" TEXT,
    "muteThreshold" INTEGER NOT NULL DEFAULT 3,
    "kickThreshold" INTEGER NOT NULL DEFAULT 5,
    "banThreshold" INTEGER NOT NULL DEFAULT 7,
    "muteDurationMin" INTEGER NOT NULL DEFAULT 60,
    "expiryDays" INTEGER,
    CONSTRAINT "WarnConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_guildId_userId_key" ON "Member"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EconomyBalance_guildId_userId_key" ON "EconomyBalance"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Warn_guildId_userId_idx" ON "Warn"("guildId", "userId");

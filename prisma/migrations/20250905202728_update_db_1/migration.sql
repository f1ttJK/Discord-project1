/*
  Warnings:

  - You are about to drop the column `globalMuteRoleId` on the `Guild` table. All the data in the column will be lost.
  - You are about to drop the column `muteRoleId` on the `MuteReason` table. All the data in the column will be lost.
  - You are about to drop the column `muteRoleId` on the `WarnReason` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guild" (
    "guild_id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "muteRoleId" TEXT,
    "muteEnabled" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Guild" ("createdAt", "guild_id") SELECT "createdAt", "guild_id" FROM "Guild";
DROP TABLE "Guild";
ALTER TABLE "new_Guild" RENAME TO "Guild";
CREATE TABLE "new_MuteReason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "punishmentType" TEXT NOT NULL DEFAULT 'Timeout',
    "punishmentDurationMin" INTEGER,
    CONSTRAINT "MuteReason_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MuteReason" ("active", "createdAt", "guildId", "id", "label", "punishmentDurationMin", "punishmentType") SELECT "active", "createdAt", "guildId", "id", "label", "punishmentDurationMin", "punishmentType" FROM "MuteReason";
DROP TABLE "MuteReason";
ALTER TABLE "new_MuteReason" RENAME TO "MuteReason";
CREATE INDEX "MuteReason_guildId_idx" ON "MuteReason"("guildId");
CREATE UNIQUE INDEX "MuteReason_guildId_label_key" ON "MuteReason"("guildId", "label");
CREATE TABLE "new_WarnConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "logChannelId" TEXT,
    "muteThreshold" INTEGER NOT NULL DEFAULT 3,
    "kickThreshold" INTEGER NOT NULL DEFAULT 5,
    "banThreshold" INTEGER NOT NULL DEFAULT 7,
    "muteDurationMin" INTEGER NOT NULL DEFAULT 60,
    "expiryDays" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WarnConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WarnConfig" ("banThreshold", "expiryDays", "guildId", "kickThreshold", "logChannelId", "muteDurationMin", "muteThreshold") SELECT "banThreshold", "expiryDays", "guildId", "kickThreshold", "logChannelId", "muteDurationMin", "muteThreshold" FROM "WarnConfig";
DROP TABLE "WarnConfig";
ALTER TABLE "new_WarnConfig" RENAME TO "WarnConfig";
CREATE TABLE "new_WarnReason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "punishmentType" TEXT NOT NULL DEFAULT 'None',
    "punishmentDurationMin" INTEGER,
    "severityLevel" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "WarnReason_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WarnReason" ("active", "createdAt", "guildId", "id", "label", "punishmentDurationMin", "punishmentType") SELECT "active", "createdAt", "guildId", "id", "label", "punishmentDurationMin", "punishmentType" FROM "WarnReason";
DROP TABLE "WarnReason";
ALTER TABLE "new_WarnReason" RENAME TO "WarnReason";
CREATE INDEX "WarnReason_guildId_idx" ON "WarnReason"("guildId");
CREATE UNIQUE INDEX "WarnReason_guildId_label_key" ON "WarnReason"("guildId", "label");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

/*
  Warnings:

  - You are about to drop the column `globalMuteRoleId` on the `WarnConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Guild" ADD COLUMN "globalMuteRoleId" TEXT;

-- CreateTable
CREATE TABLE "MuteReason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "punishmentType" TEXT NOT NULL DEFAULT 'Timeout',
    "punishmentDurationMin" INTEGER,
    "muteRoleId" TEXT,
    CONSTRAINT "MuteReason_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WarnConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "logChannelId" TEXT,
    "muteThreshold" INTEGER NOT NULL DEFAULT 3,
    "kickThreshold" INTEGER NOT NULL DEFAULT 5,
    "banThreshold" INTEGER NOT NULL DEFAULT 7,
    "muteDurationMin" INTEGER NOT NULL DEFAULT 60,
    "expiryDays" INTEGER,
    CONSTRAINT "WarnConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WarnConfig" ("banThreshold", "expiryDays", "guildId", "kickThreshold", "logChannelId", "muteDurationMin", "muteThreshold") SELECT "banThreshold", "expiryDays", "guildId", "kickThreshold", "logChannelId", "muteDurationMin", "muteThreshold" FROM "WarnConfig";
DROP TABLE "WarnConfig";
ALTER TABLE "new_WarnConfig" RENAME TO "WarnConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MuteReason_guildId_idx" ON "MuteReason"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "MuteReason_guildId_label_key" ON "MuteReason"("guildId", "label");

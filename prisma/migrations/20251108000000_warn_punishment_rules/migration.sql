-- CreateTable
CREATE TABLE "WarnPunishmentRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "warnCount" INTEGER NOT NULL,
    "punishmentType" TEXT NOT NULL,
    "punishmentDurationMin" INTEGER,
    CONSTRAINT "WarnPunishmentRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WarnPunishmentRule_guildId_idx" ON "WarnPunishmentRule"("guildId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "WarnPunishmentRule_guildId_warnCount_key" ON "WarnPunishmentRule"("guildId", "warnCount");

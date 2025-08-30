-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WarnReason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "punishmentType" TEXT NOT NULL DEFAULT 'None',
    "punishmentDurationMin" INTEGER,
    "muteRoleId" TEXT,
    CONSTRAINT "WarnReason_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WarnReason" ("active", "createdAt", "guildId", "id", "label") SELECT "active", "createdAt", "guildId", "id", "label" FROM "WarnReason";
DROP TABLE "WarnReason";
ALTER TABLE "new_WarnReason" RENAME TO "WarnReason";
CREATE INDEX "WarnReason_guildId_idx" ON "WarnReason"("guildId");
CREATE UNIQUE INDEX "WarnReason_guildId_label_key" ON "WarnReason"("guildId", "label");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

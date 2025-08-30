-- CreateTable
CREATE TABLE "WarnReason" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarnReason_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guild_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WarnReason_guildId_idx" ON "WarnReason"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "WarnReason_guildId_label_key" ON "WarnReason"("guildId", "label");

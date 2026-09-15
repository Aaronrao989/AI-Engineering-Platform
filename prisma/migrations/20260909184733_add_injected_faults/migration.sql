-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "task" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "injectedFaults" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentRun" ("createdAt", "id", "status", "task", "totalLatencyMs", "totalTokens", "updatedAt", "userId") SELECT "createdAt", "id", "status", "task", "totalLatencyMs", "totalTokens", "updatedAt", "userId" FROM "AgentRun";
DROP TABLE "AgentRun";
ALTER TABLE "new_AgentRun" RENAME TO "AgentRun";
CREATE INDEX "AgentRun_userId_idx" ON "AgentRun"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

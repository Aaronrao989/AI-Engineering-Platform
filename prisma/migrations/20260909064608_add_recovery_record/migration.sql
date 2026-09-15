-- CreateTable
CREATE TABLE "RecoveryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "failureId" TEXT,
    "strategy" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "totalMs" INTEGER NOT NULL DEFAULT 0,
    "finalError" TEXT,
    "detail" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecoveryRecord_failureId_fkey" FOREIGN KEY ("failureId") REFERENCES "FailureRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecoveryRecord_runId_idx" ON "RecoveryRecord"("runId");

-- CreateIndex
CREATE INDEX "RecoveryRecord_failureId_idx" ON "RecoveryRecord"("failureId");

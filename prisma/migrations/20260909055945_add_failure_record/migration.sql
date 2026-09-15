-- CreateTable
CREATE TABLE "FailureRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "failureType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "suggestedStrategy" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FailureRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FailureRecord_runId_idx" ON "FailureRecord"("runId");

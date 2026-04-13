-- CreateTable
CREATE TABLE "VMR" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Conference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vmrId" INTEGER NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "callId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conference_vmrId_fkey" FOREIGN KEY ("vmrId") REFERENCES "VMR" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conferenceId" INTEGER NOT NULL,
    "name" TEXT,
    "identity" TEXT,
    "joinTime" DATETIME NOT NULL,
    "leaveTime" DATETIME,
    "callUuid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VMR_name_key" ON "VMR"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Conference_callId_key" ON "Conference"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_callUuid_key" ON "Participant"("callUuid");

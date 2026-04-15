-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "audioQuality" TEXT;
ALTER TABLE "Participant" ADD COLUMN "callQuality" TEXT;
ALTER TABLE "Participant" ADD COLUMN "disconnectReason" TEXT;
ALTER TABLE "Participant" ADD COLUMN "duration" REAL;
ALTER TABLE "Participant" ADD COLUMN "videoQuality" TEXT;

-- CreateTable
CREATE TABLE "MediaStream" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "participantId" INTEGER NOT NULL,
    "streamId" TEXT,
    "streamType" TEXT NOT NULL,
    "rxBitrate" INTEGER,
    "rxCodec" TEXT,
    "rxFps" REAL,
    "rxPacketLoss" REAL,
    "rxPacketsLost" INTEGER,
    "rxPacketsRecv" INTEGER,
    "rxResolution" TEXT,
    "txBitrate" INTEGER,
    "txCodec" TEXT,
    "txFps" REAL,
    "txPacketLoss" REAL,
    "txPacketsLost" INTEGER,
    "txPacketsSent" INTEGER,
    "txResolution" TEXT,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "node" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaStream_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QualityWindow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "participantId" INTEGER NOT NULL,
    "qualityWas" TEXT,
    "qualityNow" TEXT,
    "audioQuality" INTEGER,
    "videoQuality" INTEGER,
    "presentationQuality" INTEGER,
    "overallQuality" INTEGER,
    "rxPacketsLost" INTEGER,
    "rxPacketsRecv" INTEGER,
    "txPacketsLost" INTEGER,
    "txPacketsSent" INTEGER,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualityWindow_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

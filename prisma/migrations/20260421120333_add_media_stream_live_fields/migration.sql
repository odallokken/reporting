-- Deduplicate any existing rows with the same (participantId, streamId, streamType)
-- before adding the unique index. Keep the most recently created row per group.
DELETE FROM "MediaStream"
WHERE "id" NOT IN (
    SELECT MAX("id") FROM "MediaStream"
    GROUP BY "participantId", "streamId", "streamType"
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MediaStream" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "participantId" INTEGER NOT NULL,
    "streamId" TEXT,
    "streamType" TEXT NOT NULL,
    "rxBitrate" INTEGER,
    "rxCodec" TEXT,
    "rxFps" REAL,
    "rxPacketLoss" REAL,
    "rxCurrentPacketLoss" REAL,
    "rxPacketsLost" INTEGER,
    "rxPacketsRecv" INTEGER,
    "rxResolution" TEXT,
    "rxJitter" REAL,
    "txBitrate" INTEGER,
    "txCodec" TEXT,
    "txFps" REAL,
    "txPacketLoss" REAL,
    "txCurrentPacketLoss" REAL,
    "txPacketsLost" INTEGER,
    "txPacketsSent" INTEGER,
    "txResolution" TEXT,
    "txJitter" REAL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "node" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaStream_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MediaStream" ("createdAt", "endTime", "id", "node", "participantId", "rxBitrate", "rxCodec", "rxFps", "rxPacketLoss", "rxPacketsLost", "rxPacketsRecv", "rxResolution", "startTime", "streamId", "streamType", "txBitrate", "txCodec", "txFps", "txPacketLoss", "txPacketsLost", "txPacketsSent", "txResolution") SELECT "createdAt", "endTime", "id", "node", "participantId", "rxBitrate", "rxCodec", "rxFps", "rxPacketLoss", "rxPacketsLost", "rxPacketsRecv", "rxResolution", "startTime", "streamId", "streamType", "txBitrate", "txCodec", "txFps", "txPacketLoss", "txPacketsLost", "txPacketsSent", "txResolution" FROM "MediaStream";
DROP TABLE "MediaStream";
ALTER TABLE "new_MediaStream" RENAME TO "MediaStream";
CREATE UNIQUE INDEX "MediaStream_participantId_streamId_streamType_key" ON "MediaStream"("participantId", "streamId", "streamType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "encryption" TEXT;
ALTER TABLE "Participant" ADD COLUMN "isMuted" BOOLEAN;
ALTER TABLE "Participant" ADD COLUMN "isPresenting" BOOLEAN;
ALTER TABLE "Participant" ADD COLUMN "mediaNode" TEXT;
ALTER TABLE "Participant" ADD COLUMN "rxBandwidth" INTEGER;
ALTER TABLE "Participant" ADD COLUMN "signallingNode" TEXT;
ALTER TABLE "Participant" ADD COLUMN "txBandwidth" INTEGER;

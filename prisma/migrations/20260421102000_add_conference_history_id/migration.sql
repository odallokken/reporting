ALTER TABLE "Conference" ADD COLUMN "historyId" TEXT;

CREATE UNIQUE INDEX "Conference_historyId_key" ON "Conference"("historyId");

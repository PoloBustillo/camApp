-- AlterTable: Add forensic metadata columns to recordings
ALTER TABLE "recordings" ADD COLUMN "file_hash" VARCHAR(128);
ALTER TABLE "recordings" ADD COLUMN "codec" VARCHAR(50);
ALTER TABLE "recordings" ADD COLUMN "resolution" VARCHAR(20);
ALTER TABLE "recordings" ADD COLUMN "fps" SMALLINT;
ALTER TABLE "recordings" ADD COLUMN "source_type" VARCHAR(32) NOT NULL DEFAULT 'server';
ALTER TABLE "recordings" ADD COLUMN "captured_by" VARCHAR(255);
ALTER TABLE "recordings" ADD COLUMN "capture_device" VARCHAR(255);
ALTER TABLE "recordings" ADD COLUMN "server_timestamp" TIMESTAMPTZ;
ALTER TABLE "recordings" ADD COLUMN "custody_log" JSONB;

-- CreateIndex
CREATE INDEX "idx_recordings_source_type" ON "recordings"("source_type");

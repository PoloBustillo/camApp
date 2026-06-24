-- AlterTable: Add cloud backup columns to recordings
ALTER TABLE "recordings" ADD COLUMN "cloud_storage_key" VARCHAR(500),
ADD COLUMN "cloud_backup_at" TIMESTAMPTZ,
ADD COLUMN "cloud_backup_status" VARCHAR(20) NOT NULL DEFAULT 'none';

-- CreateIndex
CREATE INDEX "idx_recordings_cloud_backup_status" ON "recordings"("cloud_backup_status");

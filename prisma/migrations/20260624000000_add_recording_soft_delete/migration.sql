-- Add soft-delete and legal hold to recordings
ALTER TABLE "recordings" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "recordings" ADD COLUMN "legal_hold" BOOLEAN NOT NULL DEFAULT false;

-- Change cascade to NO ACTION: deleting a camera must not silently destroy recordings
ALTER TABLE "recordings" DROP CONSTRAINT "recordings_camera_id_fkey";
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE NO ACTION;

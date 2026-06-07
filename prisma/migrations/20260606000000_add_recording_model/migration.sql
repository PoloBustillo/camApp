-- Add recording_deleted to AuditAction enum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'recording_deleted';

-- Create recordings table
CREATE TABLE "recordings" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "camera_id"  UUID        NOT NULL,
  "date"       DATE        NOT NULL,
  "file_name"  VARCHAR(255) NOT NULL,
  "start_time" TIMESTAMPTZ NOT NULL,
  "end_time"   TIMESTAMPTZ,
  "duration"   INTEGER,
  "file_size"  INTEGER,
  "thumbnail"  VARCHAR(500),
  CONSTRAINT "recordings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recordings_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "recordings_camera_date_file_name_key" ON "recordings"("camera_id", "date", "file_name");
CREATE INDEX "idx_recordings_camera_date" ON "recordings"("camera_id", "date" DESC);

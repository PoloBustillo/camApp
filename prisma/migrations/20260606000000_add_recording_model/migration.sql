-- Add recording_deleted to AuditAction enum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'recording_deleted';

-- Create recordings table (incluye columnas forenses y cloud backup)
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

  -- Forensic metadata
  "file_hash"       VARCHAR(128),
  "codec"           VARCHAR(50),
  "resolution"      VARCHAR(20),
  "fps"             SMALLINT,
  "source_type"     VARCHAR(32) NOT NULL DEFAULT 'server',
  "captured_by"     VARCHAR(255),
  "capture_device"  VARCHAR(255),
  "server_timestamp" TIMESTAMPTZ,
  "custody_log"     JSONB,

  -- Cloud backup
  "cloud_storage_key"    VARCHAR(500),
  "cloud_backup_at"      TIMESTAMPTZ,
  "cloud_backup_status"  VARCHAR(20) NOT NULL DEFAULT 'none',

  CONSTRAINT "recordings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recordings_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "recordings_camera_date_file_name_key" ON "recordings"("camera_id", "date", "file_name");
CREATE INDEX "idx_recordings_camera_date" ON "recordings"("camera_id", "date" DESC);
CREATE INDEX "idx_recordings_source_type" ON "recordings"("source_type");
CREATE INDEX "idx_recordings_cloud_backup_status" ON "recordings"("cloud_backup_status");
CREATE INDEX "idx_recordings_backup_time" ON "recordings"("cloud_backup_status", "start_time" DESC);
CREATE INDEX "idx_recordings_date_time" ON "recordings"("date" DESC, "start_time" DESC);

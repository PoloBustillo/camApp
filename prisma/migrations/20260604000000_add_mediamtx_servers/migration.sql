-- Create mediamtx_servers table
CREATE TABLE "mediamtx_servers" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"        VARCHAR(255) NOT NULL,
  "base_url"    VARCHAR(500) NOT NULL,
  "api_url"     VARCHAR(500) NOT NULL,
  "description" TEXT,
  "enabled"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "mediamtx_servers_pkey" PRIMARY KEY ("id")
);

-- Add columns to cameras table
ALTER TABLE "cameras"
  ADD COLUMN "mediamtx_server_id" UUID,
  ADD COLUMN "mediamtx_path"      VARCHAR(500),
  ALTER COLUMN "site_id" DROP NOT NULL;

-- Foreign key
ALTER TABLE "cameras"
  ADD CONSTRAINT "cameras_mediamtx_server_id_fkey"
  FOREIGN KEY ("mediamtx_server_id") REFERENCES "mediamtx_servers"("id") ON DELETE SET NULL;

CREATE INDEX "idx_cameras_mediamtx_server" ON "cameras"("mediamtx_server_id");

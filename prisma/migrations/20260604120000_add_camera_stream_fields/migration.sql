-- Add edgeServerId and substreamPath to cameras table
ALTER TABLE "cameras"
  ADD COLUMN "edge_server_id" UUID,
  ADD COLUMN "substream_path" VARCHAR(500);

ALTER TABLE "cameras"
  ADD CONSTRAINT "cameras_edge_server_id_fkey"
  FOREIGN KEY ("edge_server_id") REFERENCES "edge_servers"("id") ON DELETE SET NULL;

CREATE INDEX "idx_cameras_edge_server" ON "cameras"("edge_server_id");

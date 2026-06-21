-- CreateEnum
CREATE TYPE "server_type" AS ENUM ('mediaMtx', 'go2rtc');

-- AlterTable: Add server_type, go2rtc_api_port, go2rtc_webrtc_port to edge_servers
ALTER TABLE "edge_servers" ADD COLUMN "server_type" "server_type" NOT NULL DEFAULT 'mediaMtx';
ALTER TABLE "edge_servers" ADD COLUMN "go2rtc_api_port" SMALLINT NOT NULL DEFAULT 1984;
ALTER TABLE "edge_servers" ADD COLUMN "go2rtc_webrtc_port" SMALLINT NOT NULL DEFAULT 8555;

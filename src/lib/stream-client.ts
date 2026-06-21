import { MediaMtxClient } from "@/lib/mediamtx/client";
import { Go2RtcClient } from "@/lib/go2rtc/client";

type EdgeServerRecord = {
  serverType: string;
  tailscaleIp: string;
  mediamtxApiPort: number;
  go2rtcApiPort: number;
};

/**
 * Creates the appropriate streaming client (MediaMtxClient or Go2RtcClient)
 * based on the EdgeServer's serverType field.
 */
export function createStreamClient(
  server: EdgeServerRecord,
  username?: string,
  password?: string,
): MediaMtxClient | Go2RtcClient {
  if (server.serverType === "go2rtc") {
    return Go2RtcClient.fromEdgeServer(
      server as { tailscaleIp: string; go2rtcApiPort: number },
    );
  }
  return MediaMtxClient.fromEdgeServer(server, username, password);
}

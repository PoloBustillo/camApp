import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware";
import { MediaMtxClient } from "@/lib/mediamtx/client";

/**
 * GET /api/debug/mediamtx
 *
 * Diagnostic endpoint for MediaMTX + Tailscale connectivity.
 * - Lists all edge servers and their config
 * - Tests server-side reachability of MediaMTX API (Tailscale IP)
 * - Shows what WHEP URLs will be generated for each camera
 * - Only accessible to ADMIN users
 *
 * TAILSCALE ARCHITECTURE:
 *   VPS (Next.js) <--Tailscale--> Edge PC (MediaMTX)
 *   Browser -> VPS -> /api/cameras/:id/webrtc-url -> returns WHEP URL
 *   Browser -> WHEP URL directly (needs access to publicHost:webrtcPort)
 *
 *   For browser to stream:
 *   - Option A: Browser is on Tailscale → publicHost = Tailscale IP (100.x.x.x) ✓
 *   - Option B: MediaMTX port exposed publicly → publicHost = public domain/IP
 */
export async function GET() {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const edgeServers = await prisma.edgeServer.findMany({
    include: {
      cameras: {
        select: {
          id: true,
          name: true,
          mediaMtxPath: true,
          substreamPath: true,
          online: true,
          enabled: true,
        },
      },
    },
  });

  const results = await Promise.all(
    edgeServers.map(async (server) => {
      // Test API connectivity from VPS side (Tailscale IP)
      const apiUrl = `http://${server.tailscaleIp}:${server.mediamtxApiPort}/v3/paths/list`;
      let apiReachable = false;
      let apiError: string | null = null;
      let streamCount = 0;

      try {
        const authHeader = MediaMtxClient.buildAuthHeader(
          process.env.MEDIAMTX_USER,
          process.env.MEDIAMTX_PASSWORD,
        );
        const res = await fetch(apiUrl, {
          signal: AbortSignal.timeout(3000),
          headers: authHeader ? { Authorization: authHeader } : undefined,
        });
        if (res.ok) {
          const data = await res.json();
          streamCount = data.items?.length ?? 0;
          apiReachable = true;
        } else {
          apiError = `HTTP ${res.status}`;
        }
      } catch (e) {
        apiError = e instanceof Error ? e.message : "connection failed";
      }

      const sampleWhepUrls = server.cameras.slice(0, 3).map((cam) => ({
        camera: cam.name,
        online: cam.online,
        whepUrl: cam.mediaMtxPath
          ? `http://${server.publicHost}:${server.webrtcPort}/${cam.mediaMtxPath}/whep`
          : null,
        substreamWhepUrl: cam.substreamPath
          ? `http://${server.publicHost}:${server.webrtcPort}/${cam.substreamPath}/whep`
          : null,
        issue: !cam.mediaMtxPath ? "No stream path set on camera" : null,
      }));

      return {
        id: server.id,
        name: server.name,
        tailscaleIp: server.tailscaleIp,
        publicHost: server.publicHost,
        webrtcPort: server.webrtcPort,
        apiPort: server.mediamtxApiPort,
        status: server.status,
        vpsToMediaMtx: {
          url: apiUrl,
          reachable: apiReachable,
          error: apiError,
          streamsFound: streamCount,
        },
        browserConfig: {
          whepBase: `http://${server.publicHost}:${server.webrtcPort}`,
          note: server.publicHost.startsWith("100.")
            ? "TAILSCALE_IP_WARNING: browser must be on Tailscale to stream"
            : "OK: public host, browser can stream directly",
        },
        cameras: {
          total: server.cameras.length,
          online: server.cameras.filter((c) => c.online).length,
          withStreamPath: server.cameras.filter((c) => c.mediaMtxPath).length,
          sampleWhepUrls,
        },
      };
    }),
  );

  const camerasWithoutEdgeServer = await prisma.camera.count({
    where: { enabled: true, edgeServerId: null },
  });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    edgeServers: results,
    env: {
      MEDIAMTX_WEBRTC_URL: process.env.MEDIAMTX_WEBRTC_URL ?? null,
      MEDIAMTX_JWT_SECRET_SET: !!process.env.MEDIAMTX_JWT_SECRET,
    },
    warnings: [
      ...(camerasWithoutEdgeServer > 0
        ? [`${camerasWithoutEdgeServer} enabled cameras have no EdgeServer`]
        : []),
      ...(!process.env.MEDIAMTX_JWT_SECRET
        ? ["MEDIAMTX_JWT_SECRET not set — using insecure default"]
        : []),
    ],
    architecture: {
      flow: "Browser → /api/cameras/:id/webrtc-url → returns WHEP URL → Browser connects directly to MediaMTX",
      tailscaleNote: "If publicHost is Tailscale IP (100.x.x.x), browser must be enrolled in Tailscale to stream. Otherwise set publicHost to public domain/IP.",
      jwtNote: "JWT token sent as Authorization: Bearer header. MediaMTX must have authMethod=jwt configured with matching secret, OR leave auth unconfigured (token is ignored).",
    },
  });
}

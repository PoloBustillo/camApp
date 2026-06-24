/**
 * Custom server: Next.js HTTP + WebSocket proxy to go2rtc.
 *
 * Uses Bun.serve with native WebSocket support.
 * Proxies /api/cameras/:id/ws → ws://go2rtc:9997/api/ws?src=stream_name
 */
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const GO2RTC_HOST = process.env.GO2RTC_INTERNAL_HOST || process.env.GO2RTC_PUBLIC_HOST || "50.21.179.210";
const GO2RTC_WS_PORT = process.env.GO2RTC_WS_PORT || "9997";

const app = next({ dev });
const nextFetch = app.getRequestHandler();

app.prepare().then(() => {
  const server = Bun.serve({
    port,
    hostname,
    fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade: /api/cameras/:id/ws?src=stream_name
      const wsMatch = url.pathname.match(/^\/api\/cameras\/([^/]+)\/ws$/);
      if (wsMatch) {
        const streamName = url.searchParams.get("src");
        if (!streamName) {
          return new Response("Missing src param", { status: 400 });
        }

        const upgraded = server.upgrade(req, {
          data: { cameraId: wsMatch[1], streamName },
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      // Everything else → Next.js
      return nextFetch(req);
    },
    websocket: {
      open(ws) {
        const { streamName, cameraId } = ws.data;
        const go2rtcUrl = `ws://${GO2RTC_HOST}:${GO2RTC_WS_PORT}/api/ws?src=${encodeURIComponent(streamName)}`;
        console.log(`[ws-proxy] Camera ${cameraId} → ${go2rtcUrl}`);

        let go2rtcWs;
        try {
          go2rtcWs = new WebSocket(go2rtcUrl);
        } catch (err) {
          console.error(`[ws-proxy] Failed to connect to go2rtc:`, err.message);
          ws.close(1011, "Upstream connect error");
          return;
        }

        ws.data.go2rtcWs = go2rtcWs;
        ws.data.cameraId = cameraId;

        go2rtcWs.onopen = () => {
          console.log(`[ws-proxy] Camera ${cameraId} connected to go2rtc`);
        };

        go2rtcWs.onmessage = (ev) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(typeof ev.data === "string" ? ev.data : ev.data);
          }
        };

        go2rtcWs.onclose = (ev) => {
          console.log(`[ws-proxy] Camera ${cameraId} go2rtc closed (code=${ev.code})`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(ev.code, ev.reason || "Upstream closed");
          }
        };

        go2rtcWs.onerror = (ev) => {
          console.error(`[ws-proxy] Camera ${cameraId} go2rtc error`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1011, "Upstream error");
          }
        };
      },

      message(ws, message) {
        const go2rtcWs = ws.data.go2rtcWs;
        if (go2rtcWs && go2rtcWs.readyState === WebSocket.OPEN) {
          go2rtcWs.send(typeof message === "string" ? message : new TextDecoder().decode(message));
        }
      },

      close(ws, code, reason) {
        const { go2rtcWs, cameraId } = ws.data;
        console.log(`[ws-proxy] Camera ${cameraId} client closed (code=${code})`);
        if (go2rtcWs && go2rtcWs.readyState === WebSocket.OPEN) {
          go2rtcWs.close(code, reason);
        }
      },

      drain(ws) {
        // backpressure handled by Bun automatically
      },
    },
  });

  console.log(`> Ready on http://${hostname}:${port}`);
});

/**
 * Standalone WebSocket proxy for go2rtc camera streams.
 * Runs alongside Next.js on a separate port.
 *
 * Browser → wss://app/api/cameras/:id/ws → Plesk nginx → ws-proxy:8765 → go2rtc:9997
 */
const GO2RTC_HOST = process.env.GO2RTC_INTERNAL_HOST || process.env.GO2RTC_PUBLIC_HOST || "50.21.179.210";
const GO2RTC_WS_PORT = process.env.GO2RTC_WS_PORT || "9997";
const PROXY_PORT = parseInt(process.env.WS_PROXY_PORT || "8765", 10);

let connectionCount = 0;

const server = Bun.serve({
  port: PROXY_PORT,
  hostname: "0.0.0.0",
  fetch(req, server) {
    const url = new URL(req.url);

    // Match /api/cameras/:id/ws?src=stream_name
    const match = url.pathname.match(/^\/api\/cameras\/([^/]+)\/ws$/);
    if (!match) {
      return new Response("WebSocket proxy — use /api/cameras/:id/ws?src=stream_name", { status: 404 });
    }

    const streamName = url.searchParams.get("src");
    if (!streamName) {
      return new Response("Missing src parameter", { status: 400 });
    }

    const cameraId = match[1];
    const id = ++connectionCount;

    console.log(`[ws-proxy #${id}] Camera ${cameraId} → src=${streamName}`);

    const upgraded = server.upgrade(req, {
      data: { cameraId, streamName, id },
    });

    if (upgraded) return undefined;
    return new Response("WebSocket upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      const { streamName, cameraId, id } = ws.data;
      const go2rtcUrl = `ws://${GO2RTC_HOST}:${GO2RTC_WS_PORT}/api/ws?src=${encodeURIComponent(streamName)}`;

      let go2rtcWs;
      try {
        go2rtcWs = new WebSocket(go2rtcUrl);
      } catch (err) {
        console.error(`[ws-proxy #${id}] go2rtc connect error:`, err.message);
        ws.close(1011, "Upstream error");
        return;
      }

      ws.data.go2rtcWs = go2rtcWs;

      go2rtcWs.onopen = () => {
        console.log(`[ws-proxy #${id}] connected to go2rtc`);
      };

      go2rtcWs.onmessage = (ev) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(typeof ev.data === "string" ? ev.data : ev.data);
        }
      };

      go2rtcWs.onclose = (ev) => {
        console.log(`[ws-proxy #${id}] go2rtc closed (code=${ev.code})`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(ev.code, ev.reason || "Upstream closed");
        }
      };

      go2rtcWs.onerror = () => {
        console.error(`[ws-proxy #${id}] go2rtc error`);
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
      const { go2rtcWs, id } = ws.data;
      console.log(`[ws-proxy #${id}] client closed (code=${code})`);
      if (go2rtcWs && go2rtcWs.readyState === WebSocket.OPEN) {
        go2rtcWs.close(code, reason?.toString() || "Client closed");
      }
    },
  },
});

console.log(`> WebSocket proxy listening on http://0.0.0.0:${PROXY_PORT}`);

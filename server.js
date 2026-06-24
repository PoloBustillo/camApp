/**
 * Custom server: Next.js HTTP + WebSocket proxy to go2rtc.
 *
 * Uses Node.js http.createServer (compatible with Bun) + ws library
 * for proper WebSocket handling. No manual framing.
 *
 * Browser → wss://app/api/cameras/:id/ws → server.js → ws://go2rtc:9997/api/ws?src=stream
 */
const http = require("http");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const GO2RTC_HOST = process.env.GO2RTC_INTERNAL_HOST || process.env.GO2RTC_PUBLIC_HOST || "50.21.179.210";
const GO2RTC_WS_PORT = process.env.GO2RTC_WS_PORT || "9997";

const app = next({ dev });
const handle = app.getRequestHandler();

const wss = new WebSocketServer({ noServer: true });

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  server.on("upgrade", (req, socket, head) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const match = parsedUrl.pathname.match(/^\/api\/cameras\/([^/]+)\/ws$/);

    if (!match) {
      socket.destroy();
      return;
    }

    const streamName = parsedUrl.searchParams.get("src");
    if (!streamName) {
      socket.destroy();
      return;
    }

    const cameraId = match[1];
    console.log(`[ws-proxy] Camera ${cameraId} upgrade request (src=${streamName})`);

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const go2rtcUrl = `ws://${GO2RTC_HOST}:${GO2RTC_WS_PORT}/api/ws?src=${encodeURIComponent(streamName)}`;
      console.log(`[ws-proxy] Camera ${cameraId} → ${go2rtcUrl}`);

      let go2rtcWs;
      try {
        go2rtcWs = new WebSocket(go2rtcUrl);
      } catch (err) {
        console.error(`[ws-proxy] Camera ${cameraId} go2rtc connect error:`, err.message);
        clientWs.close(1011, "Upstream connect error");
        return;
      }

      go2rtcWs.on("open", () => {
        console.log(`[ws-proxy] Camera ${cameraId} connected to go2rtc`);
      });

      go2rtcWs.on("message", (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      go2rtcWs.on("close", (code, reason) => {
        console.log(`[ws-proxy] Camera ${cameraId} go2rtc closed (code=${code})`);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(code, reason?.toString() || "Upstream closed");
        }
      });

      go2rtcWs.on("error", (err) => {
        console.error(`[ws-proxy] Camera ${cameraId} go2rtc error:`, err.message);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1011, "Upstream error");
        }
      });

      clientWs.on("message", (data) => {
        if (go2rtcWs.readyState === WebSocket.OPEN) {
          go2rtcWs.send(data);
        }
      });

      clientWs.on("close", (code, reason) => {
        console.log(`[ws-proxy] Camera ${cameraId} client closed (code=${code})`);
        if (go2rtcWs.readyState === WebSocket.OPEN) {
          go2rtcWs.close(code, reason?.toString() || "Client closed");
        }
      });

      clientWs.on("error", (err) => {
        console.error(`[ws-proxy] Camera ${cameraId} client error:`, err.message);
        if (go2rtcWs.readyState === WebSocket.OPEN) {
          go2rtcWs.close(1011, "Client error");
        }
      });
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

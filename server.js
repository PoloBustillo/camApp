/**
 * Custom server: Next.js HTTP + WebSocket proxy to go2rtc.
 *
 * The browser connects to wss://app/api/cameras/:id/ws (same origin, HTTPS).
 * This server proxies the WebSocket to ws://go2rtc:9997/api/ws?src=stream_name.
 *
 * This avoids the mixed-content error (HTTPS page can't open ws://).
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// go2rtc host — internal IP reachable from Docker container
const GO2RTC_HOST = process.env.GO2RTC_INTERNAL_HOST || process.env.GO2RTC_PUBLIC_HOST || "50.21.179.210";
const GO2RTC_WS_PORT = process.env.GO2RTC_WS_PORT || "9997";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Handle WebSocket upgrade for /api/cameras/:id/ws
  server.on("upgrade", (req, socket, head) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Match /api/cameras/:id/ws
    const match = pathname.match(/^\/api\/cameras\/([^/]+)\/ws$/);
    if (!match) {
      socket.destroy();
      return;
    }

    const streamName = parsedUrl.query.src;
    if (!streamName) {
      socket.destroy();
      return;
    }

    const go2rtcWsUrl = `ws://${GO2RTC_HOST}:${GO2RTC_WS_PORT}/api/ws?src=${encodeURIComponent(streamName)}`;
    console.log(`[ws-proxy] Proxying to ${go2rtcWsUrl}`);

    // Connect to go2rtc WebSocket
    const go2rtcWs = new WebSocket(go2rtcWsUrl);

    go2rtcWs.onopen = () => {
      console.log(`[ws-proxy] Connected to go2rtc for ${streamName}`);

      // Accept the client WebSocket using the raw upgrade
      // We use the WebSocket protocol directly over the existing socket
      acceptWebSocket(req, socket, head, go2rtcWs);
    };

    go2rtcWs.onerror = (err) => {
      console.error(`[ws-proxy] go2rtc error for ${streamName}:`, err.message || err);
      socket.destroy();
    };

    go2rtcWs.onclose = () => {
      console.log(`[ws-proxy] go2rtc closed for ${streamName}`);
    };

    // Timeout: if go2rtc doesn't respond in 5s, destroy
    setTimeout(() => {
      if (go2rtcWs.readyState !== WebSocket.OPEN) {
        console.error(`[ws-proxy] Timeout connecting to go2rtc for ${streamName}`);
        go2rtcWs.close();
        socket.destroy();
      }
    }, 5000);
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

/**
 * Accept a WebSocket upgrade on the raw socket and proxy to go2rtc.
 * Implements the WebSocket framing protocol manually for maximum compatibility.
 */
function acceptWebSocket(req, socket, head, go2rtcWs) {
  // Perform WebSocket handshake
  const key = req.headers["sec-websocket-key"];
  const accept = require("crypto")
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  const response = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n");

  socket.write(response);

  // Buffer for incomplete frames
  let clientBuffer = Buffer.alloc(0);
  let go2rtcBuffer = Buffer.alloc(0);
  let clientAlive = true;
  let go2rtcAlive = true;

  const cleanup = () => {
    clientAlive = false;
    go2rtcAlive = false;
    try { socket.destroy(); } catch {}
    try { go2rtcWs.close(); } catch {}
  };

  // go2rtc → client: forward messages
  go2rtcWs.onmessage = (ev) => {
    if (!clientAlive) return;
    const data = typeof ev.data === "string" ? ev.data : ev.data;
    sendWsFrame(socket, data);
  };

  go2rtcWs.onclose = () => {
    go2rtcAlive = false;
    if (clientAlive) {
      try { socket.end(); } catch {}
    }
  };

  // client → go2rtc: read frames and forward
  socket.on("data", (chunk) => {
    if (!go2rtcAlive) return;

    clientBuffer = Buffer.concat([clientBuffer, chunk]);

    while (clientBuffer.length >= 2) {
      const firstByte = clientBuffer[0];
      const secondByte = clientBuffer[1];
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (clientBuffer.length < 4) break;
        payloadLength = clientBuffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (clientBuffer.length < 10) break;
        payloadLength = Number(clientBuffer.readBigUInt64BE(2));
        offset = 10;
      }

      let maskingKey = null;
      if (masked) {
        if (clientBuffer.length < offset + 4) break;
        maskingKey = clientBuffer.slice(offset, offset + 4);
        offset += 4;
      }

      const totalFrameLength = offset + payloadLength;
      if (clientBuffer.length < totalFrameLength) break;

      let payload = clientBuffer.slice(offset, offset + payloadLength);
      if (masked && maskingKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] = payload[i] ^ maskingKey[i % 4];
        }
      }

      // Handle close frame
      if (opcode === 0x08) {
        cleanup();
        return;
      }

      // Handle ping → pong
      if (opcode === 0x09) {
        sendWsFrame(socket, payload, 0x0a);
      }

      // Forward text/binary messages to go2rtc
      if (opcode === 0x01 || opcode === 0x02) {
        const msg = payload.toString("utf-8");
        if (go2rtcWs.readyState === WebSocket.OPEN) {
          go2rtcWs.send(msg);
        }
      }

      clientBuffer = clientBuffer.slice(totalFrameLength);
    }
  });

  socket.on("close", () => {
    clientAlive = false;
    if (go2rtcAlive) {
      try { go2rtcWs.close(); } catch {}
    }
  });

  socket.on("error", (err) => {
    console.error(`[ws-proxy] Client socket error:`, err.message);
    cleanup();
  });
}

/**
 * Send a WebSocket frame to the client (unmasked, server→client).
 */
function sendWsFrame(socket, data, opcode = 0x01) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
  const mask = false; // server frames are never masked

  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode; // FIN + opcode
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  try {
    socket.write(Buffer.concat([header, payload]));
  } catch {}
}

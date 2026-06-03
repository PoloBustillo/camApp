"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface StreamInfo {
  streamToken: string;
  whepUrl: string;
  cameraId: string;
  expiresIn: number;
}

interface CameraPlayerProps {
  cameraId: string;
  cameraName: string;
  /** Auto-start playback on mount */
  autoPlay?: boolean;
  className?: string;
  onError?: (message: string) => void;
  onPlay?: () => void;
  /** data-testid */
  "data-testid"?: string;
}

type PlayerState = "idle" | "loading" | "playing" | "error" | "offline";

/**
 * WebRTC camera player using WHEP protocol.
 *
 * Flow:
 *  1. POST /api/cameras/:id/stream  → { streamToken, whepUrl }
 *  2. WHEP negotiation:
 *     - Create RTCPeerConnection
 *     - Create SDP offer
 *     - POST offer to whepUrl with Authorization: Bearer <streamToken>
 *     - Set answer as remote description
 *  3. `<video>` renders the remote track
 */
export function CameraPlayer({
  cameraId,
  cameraName,
  autoPlay = true,
  className = "",
  onError,
  onPlay,
  "data-testid": testId,
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [state, setState] = useState<PlayerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    cleanup();
    setState("loading");
    setErrorMsg(null);

    try {
      // ── 1. Get stream token + WHEP URL ──────────────────────
      const tokenRes = await fetch(`/api/cameras/${cameraId}/stream`, {
        method: "POST",
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        const code = body?.error?.code ?? "STREAM_ERROR";
        if (code === "CAMERA_OFFLINE") {
          setState("offline");
          return;
        }
        throw new Error(body?.error?.message ?? `HTTP ${tokenRes.status}`);
      }

      const info: StreamInfo = await tokenRes.json();

      if (!info.whepUrl) {
        throw new Error(
          "MediaMTX WebRTC URL no configurada (MEDIAMTX_WEBRTC_URL)",
        );
      }

      // ── 2. WebRTC WHEP negotiation ──────────────────────────
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // We need video (and optionally audio) tracks
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          setState("error");
          setErrorMsg("Conexión WebRTC perdida");
        }
      };

      // Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to MediaMTX WHEP endpoint
      const whepRes = await fetch(info.whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Authorization: `Bearer ${info.streamToken}`,
        },
        body: pc.localDescription!.sdp,
      });

      if (!whepRes.ok) {
        throw new Error(`WHEP ${whepRes.status}: ${await whepRes.text()}`);
      }

      const answerSdp = await whepRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // ── 3. Wait for video to play ───────────────────────────
      if (videoRef.current) {
        videoRef.current.onplaying = () => {
          setState("playing");
          onPlay?.();
        };
        await videoRef.current.play().catch(() => {
          // Autoplay may be blocked; user needs to click
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al iniciar el stream";
      setState("error");
      setErrorMsg(msg);
      onError?.(msg);
      cleanup();
    }
  }, [cameraId, cleanup, onError, onPlay]);

  useEffect(() => {
    if (autoPlay) startStream();
    return cleanup;
  }, [autoPlay, startStream, cleanup]);

  // Fullscreen support
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid={testId ?? `camera-player-${cameraId}`}
      className={[
        "relative bg-black rounded-lg overflow-hidden flex items-center justify-center",
        className,
      ].join(" ")}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={[
          "w-full h-full object-contain",
          state === "playing" ? "block" : "hidden",
        ].join(" ")}
        aria-label={`Stream de ${cameraName}`}
      />

      {/* Overlay states */}
      {state === "loading" && (
        <div
          data-testid="player-loading"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <p className="text-xs">Conectando…</p>
        </div>
      )}

      {state === "idle" && (
        <button
          data-testid="player-start-btn"
          onClick={startStream}
          className="flex flex-col items-center gap-2 text-white hover:text-gray-200 transition-colors"
          aria-label="Iniciar stream"
        >
          <span className="text-4xl">▶</span>
          <span className="text-xs">{cameraName}</span>
        </button>
      )}

      {state === "offline" && (
        <div
          data-testid="player-offline"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
        >
          <span className="text-2xl">📵</span>
          <p className="text-xs font-medium">Cámara offline</p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="player-error"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white p-4"
        >
          <span className="text-2xl">⚠️</span>
          <p className="text-xs text-center">{errorMsg}</p>
          <button
            onClick={startStream}
            className="mt-2 text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Camera name overlay (always visible when playing) */}
      {state === "playing" && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
          <p className="text-white text-xs font-medium truncate">{cameraName}</p>
        </div>
      )}

      {/* Fullscreen button */}
      {(state === "playing" || state === "idle") && (
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          className="absolute top-2 right-2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded p-1 text-xs transition-colors"
        >
          {isFullscreen ? "✕" : "⛶"}
        </button>
      )}
    </div>
  );
}

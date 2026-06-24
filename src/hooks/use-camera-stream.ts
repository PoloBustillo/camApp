"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PlayerState,
  StreamType,
  WebRtcStreamInfo,
} from "@/types/camera-viewer";

export interface UseCameraStreamOptions {
  cameraId: string;
  streamType?: StreamType;
  /** Auto-start when hook mounts */
  autoConnect?: boolean;
  /** Start muted (required for grid autoplay; modal can unmute on user action) */
  startMuted?: boolean;
  onStateChange?: (state: PlayerState) => void;
}

export interface UseCameraStreamResult {
  state: PlayerState;
  errorMsg: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  connect: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
  cancelRetry: () => void;
  isAutoRetrying: boolean;
  isFrozen: boolean;
  isMuted: boolean;
  hasAudio: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (v: number) => void;
}

const MAX_FAST_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 30_000;
const FROZEN_CHECK_MS = 5_000;
const FROZEN_THRESHOLD = 3;

/**
 * Manages a single WebRTC/WHEP connection for one camera.
 *
 * Two-phase retry strategy:
 * - Phase 1 (fast): 3 attempts with exponential backoff (1s, 2s, 4s)
 * - Phase 2 (polling): every 30s indefinitely until camera responds or user cancels
 *
 * Handles CAMERA_OFFLINE / STREAM_TIMEOUT errors from the WHEP proxy by
 * entering Phase 2 immediately (network issues take time to resolve).
 */
export function useCameraStream({
  cameraId,
  streamType = "sub",
  autoConnect = false,
  startMuted = true,
  onStateChange,
}: UseCameraStreamOptions): UseCameraStreamResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [state, setState] = useState<PlayerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(startMuted);
  const [hasAudio, setHasAudio] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const connectRef = useRef<((isAutoRetry?: boolean) => Promise<void>) | null>(
    null,
  );
  const frozenCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFramesRef = useRef<number>(-1);
  const prevBytesRef = useRef<number>(-1);
  const frozenCountRef = useRef(0);

  const setStateAndNotify = useCallback(
    (s: PlayerState) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearFrozenCheck = useCallback(() => {
    if (frozenCheckRef.current) {
      clearInterval(frozenCheckRef.current);
      frozenCheckRef.current = null;
    }
    prevFramesRef.current = -1;
    prevBytesRef.current = -1;
    frozenCountRef.current = 0;
    setIsFrozen(false);
  }, []);

  const startFrozenCheck = useCallback(() => {
    clearFrozenCheck();
    frozenCheckRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== "connected") return;

      try {
        const stats = await pc.getStats();
        let framesDecoded = 0;
        let bytesReceived = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && "framesDecoded" in report) {
            framesDecoded += (report as { framesDecoded: number }).framesDecoded;
          }
          if (report.type === "inbound-rtp" && "bytesReceived" in report) {
            bytesReceived += (report as { bytesReceived: number }).bytesReceived;
          }
        });

        if (prevFramesRef.current === framesDecoded && prevBytesRef.current === bytesReceived) {
          frozenCountRef.current++;
          if (frozenCountRef.current >= FROZEN_THRESHOLD) {
            setIsFrozen(true);
          }
        } else {
          frozenCountRef.current = 0;
          setIsFrozen(false);
        }

        prevFramesRef.current = framesDecoded;
        prevBytesRef.current = bytesReceived;
      } catch {
        // getStats can fail if peer connection is closed
      }
    }, FROZEN_CHECK_MS);
  }, [clearFrozenCheck]);

  const scheduleReconnect = useCallback(
    (delayMs: number) => {
      clearReconnectTimer();
      setIsAutoRetrying(true);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connectRef.current?.(true);
      }, delayMs);
    },
    [clearReconnectTimer],
  );

  const cancelRetry = useCallback(() => {
    cancelledRef.current = true;
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;
    setIsAutoRetrying(false);
    setState((prev) =>
      prev === "reconnecting" || prev === "error" || prev === "offline"
        ? "idle"
        : prev,
    );
  }, [clearReconnectTimer]);

  const disconnect = useCallback(() => {
    cancelledRef.current = true;
    clearReconnectTimer();
    clearFrozenCheck();
    reconnectAttemptsRef.current = 0;
    setIsAutoRetrying(false);

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState((prev) =>
      prev === "playing" || prev === "connecting" || prev === "reconnecting"
        ? "idle"
        : prev,
    );
  }, [clearReconnectTimer, clearFrozenCheck]);

  const connect = useCallback(
    async (isAutoRetry = false) => {
      if (!isAutoRetry) {
        reconnectAttemptsRef.current = 0;
        cancelledRef.current = false;
      }

      if (cancelledRef.current) return;

      clearReconnectTimer();
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setStateAndNotify("connecting");
      setErrorMsg(null);

      try {
        // ── 1. Fetch WHEP URL server-side ────────────────────────────
        const res = await fetch(
          `/api/cameras/${cameraId}/webrtc-url?type=${streamType}`,
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const code = body?.error?.code ?? "STREAM_ERROR";
          if (code === "CAMERA_DISABLED") {
            setStateAndNotify("offline");
            setErrorMsg("Cámara deshabilitada");
            return;
          }
          if (code === "CAMERA_OFFLINE" || code === "STREAM_TIMEOUT") {
            // Network issue — go straight to Phase 2 polling
            setStateAndNotify("offline");
            setErrorMsg("Cámara offline — reintentando cada 30s...");
            scheduleReconnect(POLL_INTERVAL_MS);
            return;
          }
          throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
        }

        const info: WebRtcStreamInfo = await res.json();

        // If server says camera is offline, enter polling mode
        if (info.isOffline) {
          setStateAndNotify("offline");
          setErrorMsg("Cámara offline — reintentando cada 30s...");
          scheduleReconnect(POLL_INTERVAL_MS);
          return;
        }

        // ── 2. WebRTC WHEP negotiation ───────────────────────────────
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          iceTransportPolicy: "all",
        });
        pcRef.current = pc;

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        pc.ontrack = ({ streams, track }) => {
          if (track.kind === "audio") setHasAudio(true);
          if (videoRef.current && streams[0]) {
            videoRef.current.srcObject = streams[0];
            videoRef.current.muted = isMuted;
            videoRef.current.volume = volume;
            const audioTracks = streams[0].getAudioTracks();
            if (audioTracks.length > 0) setHasAudio(true);
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (cancelledRef.current) return;

          if (
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "disconnected"
          ) {
            if (reconnectAttemptsRef.current < MAX_FAST_ATTEMPTS) {
              // Phase 1: fast exponential backoff (1s, 2s, 4s)
              const attempt = reconnectAttemptsRef.current + 1;
              reconnectAttemptsRef.current = attempt;
              const delay = Math.pow(2, attempt - 1) * 1000;
              setStateAndNotify("reconnecting");
              setErrorMsg(
                `Reconectando... (intento ${attempt}/${MAX_FAST_ATTEMPTS})`,
              );
              scheduleReconnect(delay);
            } else {
              // Phase 2: slow polling every 30s
              setStateAndNotify("offline");
              setErrorMsg("Cámara offline — reintentando cada 30s...");
              scheduleReconnect(POLL_INTERVAL_MS);
            }
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const whepRes = await fetch(info.whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription!.sdp,
        });

        if (!whepRes.ok) {
          const errText = await whepRes.text();
          let errBody: { error?: { code?: string; message?: string } } = {};
          try { errBody = JSON.parse(errText); } catch { /* not JSON */ }
          const errCode = errBody?.error?.code;
          if (
            errCode === "CAMERA_OFFLINE" ||
            errCode === "STREAM_TIMEOUT" ||
            whepRes.status === 502
          ) {
            setStateAndNotify("offline");
            setErrorMsg("Cámara offline — reintentando cada 30s...");
            scheduleReconnect(POLL_INTERVAL_MS);
            return;
          }
          throw new Error(
            `WHEP error ${whepRes.status}: ${errBody?.error?.message ?? errText}`,
          );
        }

        const answerSdp = await whepRes.text();

        // ── 3. Wait for video ────────────────────────────────────────
        if (videoRef.current) {
          const video = videoRef.current;
          video.onplaying = () => {
            reconnectAttemptsRef.current = 0;
            setIsAutoRetrying(false);
            setStateAndNotify("playing");
            startFrozenCheck();
          };

          await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
          video.play().catch(() => {});

          // Fallback: if onplaying never fires, poll for playing state
          setTimeout(() => {
            if (
              video.readyState >= 2 &&
              !video.paused &&
              state !== "playing"
            ) {
              reconnectAttemptsRef.current = 0;
              setIsAutoRetrying(false);
              setStateAndNotify("playing");
              startFrozenCheck();
            }
          }, 2000);
        } else {
          await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        }
      } catch (err) {
        if (cancelledRef.current) return;
        const msg =
          err instanceof Error ? err.message : "Error al iniciar stream";
        setStateAndNotify("error");
        setErrorMsg(msg);
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
      }
    },
    [cameraId, streamType, setStateAndNotify, isMuted, volume, scheduleReconnect],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
        if (!next) videoRef.current.play().catch(() => {});
      }
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    if (videoRef.current) videoRef.current.volume = clamped;
    if (clamped > 0) setIsMuted(false);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume, state]);

  // Keep forward ref up to date
  connectRef.current = connect;

  // Auto-reconnect when frozen is detected
  useEffect(() => {
    if (isFrozen && state === "playing") {
      console.log(`[camstream] Camera ${cameraId} frozen — reconnecting`);
      clearFrozenCheck();
      // Disconnect and reconnect
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStateAndNotify("reconnecting");
      setErrorMsg("Imagen congelada — reconectando...");
      reconnectAttemptsRef.current = 0;
      setIsAutoRetrying(true);
      scheduleReconnect(2000);
    }
  }, [isFrozen, state, cameraId, clearFrozenCheck, setStateAndNotify, scheduleReconnect]);

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect) connect();
    return disconnect;
  }, [autoConnect, connect, disconnect]);

  return {
    state,
    errorMsg,
    videoRef,
    connect,
    disconnect,
    retry: connect,
    cancelRetry,
    isAutoRetrying,
    isFrozen,
    isMuted,
    hasAudio,
    volume,
    toggleMute,
    setVolume,
  };
}

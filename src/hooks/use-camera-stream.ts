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
const RECONNECT_COOLDOWN_MS = 30_000;

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
  const cleanupStallRef = useRef<(() => void) | null>(null);
  const streamTypeRef = useRef(streamType);
  const originalStreamTypeRef = useRef(streamType);
  const frozenReconnectCountRef = useRef(0);
  const lastReconnectTimeRef = useRef(0);

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
    cleanupStallRef.current?.();
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
  }, [clearReconnectTimer]);

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
          `/api/cameras/${cameraId}/webrtc-url?type=${streamTypeRef.current}`,
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
        // Match go2rtc's VideoRTC config: max-bundle, unified-plan, two STUN servers
        const pc = new RTCPeerConnection({
          bundlePolicy: "max-bundle",
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun.cloudflare.com:3478" },
          ],
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

        // Detect video stalls via native browser events
        if (videoRef.current) {
          const video = videoRef.current;
          let stallTimer: ReturnType<typeof setTimeout> | null = null;

          const onVideoWaiting = () => {
            if (cancelledRef.current) return;
            // Clear any existing timer
            if (stallTimer) clearTimeout(stallTimer);
            // Wait 30s — if video hasn't resumed, it's truly frozen
            stallTimer = setTimeout(() => {
              if (cancelledRef.current) return;
              if (Date.now() - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;
              if (video && video.readyState < 2 && !video.paused) {
                console.log(`[camstream] Camera ${cameraId} video stalled 30s (readyState=${video.readyState}, networkState=${video.networkState}, currentTime=${video.currentTime})`);
                setIsFrozen(true);
              }
            }, 30_000);
          };
          const onVideoPlaying = () => {
            if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
            setIsFrozen(false);
          };
          video.addEventListener("waiting", onVideoWaiting);
          video.addEventListener("playing", onVideoPlaying);
          video.addEventListener("canplay", onVideoPlaying);
          cleanupStallRef.current = () => {
            if (stallTimer) clearTimeout(stallTimer);
            video.removeEventListener("waiting", onVideoWaiting);
            video.removeEventListener("playing", onVideoPlaying);
            video.removeEventListener("canplay", onVideoPlaying);
          };
        }

        pc.oniceconnectionstatechange = () => {
          console.log(`[camstream] Camera ${cameraId} ICE: ${pc.iceConnectionState}, conn: ${pc.connectionState}`);
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

        // Wait for ICE gathering to complete so all candidates are in the SDP.
        // Without this, mobile devices with slow ICE gathering send offers with
        // no candidates → connection freezes when candidates arrive too late.
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
            return;
          }
          const check = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", check);
          // Safety timeout: don't block forever
          setTimeout(() => {
            pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }, 5000);
        });

        console.log(`[camstream] Camera ${cameraId} ICE gathering: ${pc.iceGatheringState}, candidates in SDP: ${(pc.localDescription!.sdp.match(/a=candidate:/g) || []).length}`);

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
        console.log(`[camstream] Camera ${cameraId} SDP answer received, length: ${answerSdp.length}`);

        // ── 3. Wait for video ────────────────────────────────────────
        if (videoRef.current) {
          const video = videoRef.current;
          video.onplaying = () => {
            reconnectAttemptsRef.current = 0;
            frozenReconnectCountRef.current = 0;
            lastReconnectTimeRef.current = 0;
            streamTypeRef.current = originalStreamTypeRef.current;
            setIsAutoRetrying(false);
            setIsFrozen(false);
            setStateAndNotify("playing");
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
              frozenReconnectCountRef.current = 0;
              lastReconnectTimeRef.current = 0;
              streamTypeRef.current = originalStreamTypeRef.current;
              setIsAutoRetrying(false);
              setIsFrozen(false);
              setStateAndNotify("playing");
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
    [cameraId, setStateAndNotify, isMuted, volume, scheduleReconnect],
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

  // Auto-reconnect when frozen is detected (30s stall from native events)
  useEffect(() => {
    if (isFrozen && state === "playing") {
      const now = Date.now();
      if (now - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;

      frozenReconnectCountRef.current++;
      lastReconnectTimeRef.current = now;
      console.log(`[camstream] Camera ${cameraId} frozen — reconnecting (attempt ${frozenReconnectCountRef.current})`);

      if (
        frozenReconnectCountRef.current >= 3 &&
        streamTypeRef.current === "sub"
      ) {
        console.log(`[camstream] Sub stream frozen 3 times — switching to main`);
        streamTypeRef.current = "main";
        frozenReconnectCountRef.current = 0;
      }

      // Disconnect and reconnect
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (videoRef.current) {
        cleanupStallRef.current?.();
        videoRef.current.srcObject = null;
      }
      setStateAndNotify("reconnecting");
      setErrorMsg(
        streamTypeRef.current === "main"
          ? "Imagen congelada — usando stream principal..."
          : "Imagen congelada — reconectando..."
      );
      reconnectAttemptsRef.current = 0;
      setIsAutoRetrying(true);
      scheduleReconnect(3000);
    }
  }, [isFrozen, state, cameraId, setStateAndNotify, scheduleReconnect]);

  // Mobile: refresh stream when returning from background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;

      const pc = pcRef.current;
      if (!pc) return;

      // If video is playing, check if stream is still alive
      const video = videoRef.current;
      if (video && state === "playing") {
        // On mobile, browser may have paused the video
        if (video.paused) {
          video.play().catch(() => {});
        }
      }

      // If connection is "connected" but video has no frames after 10s, force reconnect
      if (pc.iceConnectionState === "connected" && video && state === "playing") {
        setTimeout(() => {
          if (document.hidden) return;
          if (!videoRef.current || !pcRef.current) return;
          // Cooldown check
          if (Date.now() - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;

          const currentVideo = videoRef.current;
          if (currentVideo && (currentVideo.readyState < 2 || currentVideo.paused)) {
            console.log(`[camstream] Camera ${cameraId} stale after background — refreshing`);

            lastReconnectTimeRef.current = Date.now();

            if (pcRef.current) {
              pcRef.current.close();
              pcRef.current = null;
            }
            cleanupStallRef.current?.();
            currentVideo.srcObject = null;
            setStateAndNotify("reconnecting");
            setErrorMsg("Refrescando stream...");
            reconnectAttemptsRef.current = 0;
            setIsAutoRetrying(true);
            scheduleReconnect(1000);
          }
        }, 10_000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state, cameraId, setStateAndNotify, scheduleReconnect]);

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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onVisibleOnce, removeVisibleListener } from "@/lib/visibility-manager";
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
const STALL_CHECK_MS = 2_000;
const STALL_THRESHOLD_MS = 5_000;

/**
 * WebRTC connection matching go2rtc's video-rtc.js behavior.
 *
 * Key changes from previous version:
 * - Removed temp video warmup (assigns stream directly to main video)
 * - Replaced waiting-event stall detection with currentTime polling
 * - connect/disconnect are stable refs (never change identity)
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
  const cleanupStallRef = useRef<(() => void) | null>(null);
  const streamTypeRef = useRef(streamType);
  const originalStreamTypeRef = useRef(streamType);
  const frozenReconnectCountRef = useRef(0);
  const lastReconnectTimeRef = useRef(0);
  const isMutedRef = useRef(startMuted);
  const volumeRef = useRef(1);
  const stateRef = useRef<PlayerState>("idle");

  // Keep refs in sync with state
  isMutedRef.current = isMuted;
  volumeRef.current = volume;
  stateRef.current = state;

  const setStateAndNotify = useCallback(
    (s: PlayerState) => {
      setState(s);
      stateRef.current = s;
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
        connectInternal(true);
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

  // Use a plain function (not useCallback) so connectInternal always has latest refs.
  // Exposed `connect` is a stable ref wrapper.
  async function connectInternal(isAutoRetry = false) {
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
      // 1. Fetch WHEP URL
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
          setStateAndNotify("offline");
          setErrorMsg("Cámara offline — reintentando cada 30s...");
          scheduleReconnect(POLL_INTERVAL_MS);
          return;
        }
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }

      const info: WebRtcStreamInfo = await res.json();

      if (info.isOffline) {
        setStateAndNotify("offline");
        setErrorMsg("Cámara offline — reintentando cada 30s...");
        scheduleReconnect(POLL_INTERVAL_MS);
        return;
      }

      // 2. WebRTC — match go2rtc's video-rtc.js
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

      pc.ontrack = ({ track }) => {
        if (track.kind === "audio") setHasAudio(true);
      };

      // Connection state handler — assign stream directly to main video
      let videoAssigned = false;

      pc.onconnectionstatechange = () => {
        const connState = pc.connectionState;
        console.log(`[camstream] Camera ${cameraId} connection: ${connState}`);

        if (cancelledRef.current) return;

        if (connState === "connected" && !videoAssigned) {
          videoAssigned = true;
          const tracks = pc
            .getTransceivers()
            .filter((tr) => tr.currentDirection === "recvonly")
            .map((tr) => tr.receiver.track);

          if (tracks.length > 0 && videoRef.current) {
            const stream = new MediaStream(tracks);
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) setHasAudio(true);

            // Assign directly to main video (no temp video warmup)
            videoRef.current.srcObject = stream;
            videoRef.current.muted = isMutedRef.current;
            videoRef.current.volume = volumeRef.current;
            videoRef.current.play().catch(() => {});
            console.log(`[camstream] Camera ${cameraId} video assigned (${tracks.length} tracks)`);
          }
        }

        if (connState === "failed" || connState === "disconnected") {
          if (reconnectAttemptsRef.current < MAX_FAST_ATTEMPTS) {
            const attempt = reconnectAttemptsRef.current + 1;
            reconnectAttemptsRef.current = attempt;
            const delay = Math.pow(2, attempt - 1) * 1000;
            setStateAndNotify("reconnecting");
            setErrorMsg(
              `Reconectando... (intento ${attempt}/${MAX_FAST_ATTEMPTS})`,
            );
            scheduleReconnect(delay);
          } else {
            setStateAndNotify("offline");
            setErrorMsg("Cámara offline — reintentando cada 30s...");
            scheduleReconnect(POLL_INTERVAL_MS);
          }
        }
      };

      // Stall detection via currentTime polling (replaces waiting-event approach)
      // Checks every 2s. If currentTime hasn't changed for 5s, video is frozen.
      if (videoRef.current) {
        const video = videoRef.current;
        let lastTime = video.currentTime;
        let lastTimeChange = Date.now();

        const checkInterval = setInterval(() => {
          if (cancelledRef.current) {
            clearInterval(checkInterval);
            return;
          }
          if (video.currentTime !== lastTime) {
            lastTime = video.currentTime;
            lastTimeChange = Date.now();
            setIsFrozen(false);
          } else if (Date.now() - lastTimeChange > STALL_THRESHOLD_MS) {
            if (Date.now() - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;
            if (stateRef.current !== "playing") return;
            console.log(
              `[camstream] Camera ${cameraId} video stalled ${STALL_THRESHOLD_MS}ms (currentTime=${video.currentTime}, readyState=${video.readyState}, networkState=${video.networkState})`,
            );
            setIsFrozen(true);
            lastTimeChange = Date.now(); // reset to avoid repeated triggers
          }
        }, STALL_CHECK_MS);

        cleanupStallRef.current = () => {
          clearInterval(checkInterval);
        };
      }

      // 3. SDP exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log(`[camstream] Camera ${cameraId} offer created, ICE: ${pc.iceGatheringState}`);

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
      console.log(`[camstream] Camera ${cameraId} answer received (${answerSdp.length} bytes, candidates: ${(answerSdp.match(/a=candidate:/g) || []).length})`);

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      const markPlaying = () => {
        if (cancelledRef.current) return;
        reconnectAttemptsRef.current = 0;
        frozenReconnectCountRef.current = 0;
        lastReconnectTimeRef.current = 0;
        streamTypeRef.current = originalStreamTypeRef.current;
        setIsAutoRetrying(false);
        setIsFrozen(false);
        setStateAndNotify("playing");
      };

      if (videoRef.current) {
        videoRef.current.onplaying = markPlaying;
      }

      // Fallback: if playing doesn't fire within 5s, mark anyway
      setTimeout(() => {
        if (stateRef.current !== "playing" && !cancelledRef.current) {
          markPlaying();
        }
      }, 5000);
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
  }

  // Stable connect wrapper — always calls the latest connectInternal
  const connectRef = useRef(connectInternal);
  connectRef.current = connectInternal;

  const connect = useCallback(() => connectRef.current(), []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
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
    volumeRef.current = clamped;
    if (videoRef.current) videoRef.current.volume = clamped;
    if (clamped > 0) setIsMuted(false);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume, state]);

  // Auto-reconnect when frozen is detected
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
    const handleVisible = () => {
      const pc = pcRef.current;
      if (!pc) return;

      const video = videoRef.current;
      if (video && state === "playing") {
        if (video.paused) {
          video.play().catch(() => {});
        }
      }

      if (pc.connectionState === "connected" && video && state === "playing") {
        setTimeout(() => {
          if (document.hidden) return;
          if (!videoRef.current || !pcRef.current) return;
          if (Date.now() - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;

          const currentVideo = videoRef.current;
          if (currentVideo && (currentVideo.readyState < 2 || currentVideo.paused)) {
            console.log(`[camstream] Camera ${cameraId} stale after background — refreshing`);
            lastReconnectTimeRef.current = Date.now();
            if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
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

    onVisibleOnce(cameraId, handleVisible);
    return () => removeVisibleListener(cameraId);
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

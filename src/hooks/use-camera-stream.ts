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
  isMuted: boolean;
  hasAudio: boolean;
  volume: number;
  toggleMute: () => void;
  setVolume: (v: number) => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * Manages a single WebRTC/WHEP connection for one camera.
 *
 * Architecture decisions:
 * - Fetches WHEP URL server-side to avoid exposing internal IPs
 * - RTCPeerConnection is created fresh on each connect() call
 * - disconnect() closes the PC immediately and frees resources
 * - Suitable for use with IntersectionObserver (connect/disconnect on visibility)
 * - Auto-reconnect with exponential backoff on ICE failure
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

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Forward reference so timer callbacks always call the latest connect
  const connectRef = useRef<((isAutoRetry?: boolean) => Promise<void>) | null>(
    null,
  );

  const setStateAndNotify = useCallback(
    (s: PlayerState) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;

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
  }, []);

  const connect = useCallback(
    async (isAutoRetry = false) => {
      if (!isAutoRetry) {
        reconnectAttemptsRef.current = 0;
      }

      // Close any existing connection without resetting the attempts counter
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
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
          if (code === "CAMERA_OFFLINE" || code === "CAMERA_DISABLED") {
            setStateAndNotify("offline");
            return;
          }
          throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
        }

        const info: WebRtcStreamInfo = await res.json();

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
          if (
            pc.iceConnectionState === "failed" ||
            pc.iceConnectionState === "disconnected"
          ) {
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              const attempt = reconnectAttemptsRef.current + 1;
              reconnectAttemptsRef.current = attempt;
              const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
              setStateAndNotify("reconnecting");
              setErrorMsg(
                `Reconectando... (intento ${attempt}/${MAX_RECONNECT_ATTEMPTS})`,
              );
              reconnectTimerRef.current = setTimeout(
                () => connectRef.current?.(true),
                delay,
              );
            } else {
              setStateAndNotify("error");
              setErrorMsg("No se pudo reconectar después de 3 intentos");
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
          throw new Error(
            `WHEP error ${whepRes.status}: ${await whepRes.text()}`,
          );
        }

        const answerSdp = await whepRes.text();

        // ── 3. Wait for video ────────────────────────────────────────
        // Set onplaying BEFORE setRemoteDescription to avoid race condition
        if (videoRef.current) {
          const video = videoRef.current;
          video.onplaying = () => setStateAndNotify("playing");

          await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
          video.play().catch(() => {});

          // Fallback: if onplaying never fires, poll for playing state
          setTimeout(() => {
            if (
              video.readyState >= 2 &&
              !video.paused &&
              state !== "playing"
            ) {
              setStateAndNotify("playing");
            }
          }, 2000);
        } else {
          await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        }
      } catch (err) {
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
    [cameraId, streamType, setStateAndNotify, isMuted, volume],
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
    isMuted,
    hasAudio,
    volume,
    toggleMute,
    setVolume,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerState, StreamType, WebRtcStreamInfo } from "@/types/camera-viewer";

export interface UseCameraStreamOptions {
  cameraId: string;
  streamType?: StreamType;
  /** Auto-start when hook mounts */
  autoConnect?: boolean;
  onStateChange?: (state: PlayerState) => void;
}

export interface UseCameraStreamResult {
  state: PlayerState;
  errorMsg: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  connect: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
}

/**
 * Manages a single WebRTC/WHEP connection for one camera.
 *
 * Architecture decisions:
 * - Fetches WHEP URL server-side to avoid exposing internal IPs
 * - RTCPeerConnection is created fresh on each connect() call
 * - disconnect() closes the PC immediately and frees resources
 * - Suitable for use with IntersectionObserver (connect/disconnect on visibility)
 */
export function useCameraStream({
  cameraId,
  streamType = "sub",
  autoConnect = false,
  onStateChange,
}: UseCameraStreamOptions): UseCameraStreamResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [state, setState] = useState<PlayerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setStateAndNotify = useCallback(
    (s: PlayerState) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState((prev) => (prev === "playing" || prev === "connecting" ? "idle" : prev));
  }, []);

  const connect = useCallback(async () => {
    disconnect();
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

      pc.ontrack = ({ streams }) => {
        if (videoRef.current && streams[0]) {
          videoRef.current.srcObject = streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected"
        ) {
          setStateAndNotify("error");
          setErrorMsg("Conexión perdida");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const whepRes = await fetch(info.whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Authorization: `Bearer ${info.streamToken}`,
        },
        body: pc.localDescription!.sdp,
      });

      if (!whepRes.ok) {
        throw new Error(`WHEP error ${whepRes.status}: ${await whepRes.text()}`);
      }

      const answerSdp = await whepRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // ── 3. Wait for video ────────────────────────────────────────
      if (videoRef.current) {
        videoRef.current.onplaying = () => setStateAndNotify("playing");
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al iniciar stream";
      setStateAndNotify("error");
      setErrorMsg(msg);
      disconnect();
    }
  }, [cameraId, streamType, disconnect, setStateAndNotify]);

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect) connect();
    return disconnect;
  }, [autoConnect, connect, disconnect]);

  return { state, errorMsg, videoRef, connect, disconnect, retry: connect };
}

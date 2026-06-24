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
  autoConnect?: boolean;
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
const RECONNECT_TIMEOUT_MS = 15_000;
const STALL_CHECK_MS = 2_000;
const STALL_THRESHOLD_MS = 5_000;

/**
 * WebRTC connection using go2rtc's WebSocket signaling.
 *
 * Matches go2rtc's video-rtc.js behavior:
 * - WebSocket to /api/ws for signaling (ICE trickle)
 * - RTCPeerConnection with bundlePolicy max-bundle
 * - Tracks from transceivers on connectionstatechange 'connected'
 * - Close WebSocket after WebRTC connects
 * - Reconnect on 'failed' or 'disconnected'
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
  const wsRef = useRef<WebSocket | null>(null);
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
  const wsUrlRef = useRef<string | null>(null);
  const connectTsRef = useRef(0);

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

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    clearReconnectTimer();
    cleanupStallRef.current?.();
    reconnectAttemptsRef.current = 0;
    setIsAutoRetrying(false);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => {
        if (s.track) s.track.stop();
      });
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

  // Plain function with latest refs — called via connectRef
  async function connectInternal(isAutoRetry = false) {
    if (!isAutoRetry) {
      reconnectAttemptsRef.current = 0;
      cancelledRef.current = false;
    }

    if (cancelledRef.current) return;

    clearReconnectTimer();
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => { if (s.track) s.track.stop(); });
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStateAndNotify("connecting");
    setErrorMsg(null);

    try {
      // 1. Fetch WebSocket URL from server
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

      const wsUrl = info.wsUrl;
      if (!wsUrl) {
        throw new Error("No WebSocket URL provided by server");
      }

      console.log(`[camstream] Camera ${cameraId} connecting via WS: ${wsUrl}`);

      // 2. Create RTCPeerConnection — match go2rtc's video-rtc.js exactly
      const pc = new RTCPeerConnection({
        bundlePolicy: "max-bundle",
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "stun:stun.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = ({ track }) => {
        if (track.kind === "audio") setHasAudio(true);
      };

      // Connection state handler
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

            // Assign directly to main video
            videoRef.current.srcObject = stream;
            videoRef.current.muted = isMutedRef.current;
            videoRef.current.volume = volumeRef.current;

            // go2rtc play() with auto-mute fallback
            videoRef.current.play().catch(() => {
              if (videoRef.current && !videoRef.current.muted) {
                videoRef.current.muted = true;
                videoRef.current.play().catch(() => {});
              }
            });

            console.log(`[camstream] Camera ${cameraId} video assigned (${tracks.length} tracks)`);

            // Close WebSocket after WebRTC connects (like go2rtc)
            if (wsRef.current) {
              console.log(`[camstream] Camera ${cameraId} closing WS (WebRTC connected)`);
              wsRef.current.close();
              wsRef.current = null;
            }
          }
        }

        if (connState === "failed" || connState === "disconnected") {
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          if (reconnectAttemptsRef.current < MAX_FAST_ATTEMPTS) {
            const attempt = reconnectAttemptsRef.current + 1;
            reconnectAttemptsRef.current = attempt;
            const delay = Math.pow(2, attempt - 1) * 1000;
            setStateAndNotify("reconnecting");
            setErrorMsg(`Reconectando... (intento ${attempt}/${MAX_FAST_ATTEMPTS})`);
            scheduleReconnect(delay);
          } else {
            setStateAndNotify("offline");
            setErrorMsg("Cámara offline — reintentando cada 30s...");
            scheduleReconnect(POLL_INTERVAL_MS);
          }
        }
      };

      // Stall detection via currentTime polling
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
              `[camstream] Camera ${cameraId} video stalled ${STALL_THRESHOLD_MS}ms (currentTime=${video.currentTime})`,
            );
            setIsFrozen(true);
            lastTimeChange = Date.now();
          }
        }, STALL_CHECK_MS);

        cleanupStallRef.current = () => {
          clearInterval(checkInterval);
        };
      }

      // 3. Open WebSocket for signaling (like go2rtc's onconnect)
      const wsConnectTS = Date.now();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (cancelledRef.current) return;
        console.log(`[camstream] Camera ${cameraId} WS open`);

        // Create offer and send via WebSocket (go2rtc's onwebrtc)
        pc.createOffer().then((offer) => {
          return pc.setLocalDescription(offer);
        }).then(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "webrtc/offer",
              value: pc.localDescription!.sdp,
            }));
            console.log(`[camstream] Camera ${cameraId} offer sent via WS`);
          }
        }).catch((err) => {
          console.error(`[camstream] Camera ${cameraId} offer error:`, err);
          setStateAndNotify("error");
          setErrorMsg(err.message);
        });
      });

      ws.addEventListener("message", (ev) => {
        if (typeof ev.data !== "string") return;
        const msg = JSON.parse(ev.data);

        if (msg.type === "webrtc/answer" && pcRef.current) {
          console.log(`[camstream] Camera ${cameraId} answer received`);
          pcRef.current.setRemoteDescription({
            type: "answer",
            sdp: msg.value,
          }).catch((err) => {
            console.error(`[camstream] Camera ${cameraId} setRemoteDescription error:`, err);
          });
        }

        if (msg.type === "webrtc/candidate" && pcRef.current) {
          pcRef.current.addIceCandidate({
            candidate: msg.value,
            sdpMid: "0",
          }).catch((err) => {
            console.warn(`[camstream] Camera ${cameraId} addIceCandidate error:`, err);
          });
        }

        if (msg.type === "error") {
          console.error(`[camstream] Camera ${cameraId} server error: ${msg.value}`);
          setStateAndNotify("error");
          setErrorMsg(msg.value);
        }
      });

      ws.addEventListener("close", () => {
        console.log(`[camstream] Camera ${cameraId} WS closed`);
        wsRef.current = null;

        // If WS closed before WebRTC connected, reconnect (like go2rtc onclose)
        if (!videoAssigned && !cancelledRef.current) {
          const delay = Math.max(RECONNECT_TIMEOUT_MS - (Date.now() - wsConnectTS), 0);
          scheduleReconnect(delay);
        }
      });

      ws.addEventListener("error", () => {
        console.error(`[camstream] Camera ${cameraId} WS error`);
      });

      // Fallback: if playing doesn't fire within 5s, mark anyway
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

      setTimeout(() => {
        if (stateRef.current !== "playing" && !cancelledRef.current) {
          markPlaying();
        }
      }, 5000);
    } catch (err) {
      if (cancelledRef.current) return;
      const msg = err instanceof Error ? err.message : "Error al iniciar stream";
      setStateAndNotify("error");
      setErrorMsg(msg);
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    }
  }

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

  // Auto-reconnect when frozen
  useEffect(() => {
    if (isFrozen && state === "playing") {
      const now = Date.now();
      if (now - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;

      frozenReconnectCountRef.current++;
      lastReconnectTimeRef.current = now;
      console.log(`[camstream] Camera ${cameraId} frozen — reconnecting (attempt ${frozenReconnectCountRef.current})`);

      if (frozenReconnectCountRef.current >= 3 && streamTypeRef.current === "sub") {
        console.log(`[camstream] Sub stream frozen 3 times — switching to main`);
        streamTypeRef.current = "main";
        frozenReconnectCountRef.current = 0;
      }

      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
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
      if (video && state === "playing" && video.paused) {
        video.play().catch(() => {});
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
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
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
    return cleanup;
  }, [autoConnect, connect, cleanup]);

  return {
    state,
    errorMsg,
    videoRef,
    connect,
    disconnect: cleanup,
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

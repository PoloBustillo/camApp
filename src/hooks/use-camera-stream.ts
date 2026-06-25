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
  /** Use WHEP/HTTP signaling instead of WebSocket (better for TV browsers) */
  preferWhep?: boolean;
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
const STALL_CHECK_MS = 5_000;
const STALL_THRESHOLD_MS = 8_000;

const __DEV__ = process.env.NODE_ENV !== "production";
const dbg = __DEV__ ? console.log.bind(console) : () => {};
const dbgWarn = __DEV__ ? console.warn.bind(console) : () => {};

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
  preferWhep = false,
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
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamTypeRef = useRef(streamType);
  const originalStreamTypeRef = useRef(streamType);
  const frozenReconnectCountRef = useRef(0);
  const lastReconnectTimeRef = useRef(0);
  const isMutedRef = useRef(startMuted);
  const volumeRef = useRef(1);
  const stateRef = useRef<PlayerState>("idle");
  const wsUrlRef = useRef<string | null>(null);
  const connectTsRef = useRef(0);
  const isFrozenRef = useRef(false);
  const useWhepRef = useRef(preferWhep);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  isMutedRef.current = isMuted;
  volumeRef.current = volume;
  stateRef.current = state;

  const setStateAndNotify = useCallback(
    (s: PlayerState) => {
      setState(s);
      stateRef.current = s;
      onStateChangeRef.current?.(s);
    },
    [],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
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
      videoRef.current.onplaying = null;
      videoRef.current.srcObject = null;
    }
    setState((prev) =>
      prev === "playing" || prev === "connecting" || prev === "reconnecting"
        ? "idle"
        : prev,
    );
  }, [clearReconnectTimer]);

  function isRetryableError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return (
      msg.includes("whep") ||
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("connection") ||
      msg.includes("unreachable") ||
      msg.includes("ice gathering") ||
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("network")
    );
  }

  // Plain function with latest refs — called via connectRef
  async function connectInternal(isAutoRetry = false) {
    if (!isAutoRetry) {
      reconnectAttemptsRef.current = 0;
      cancelledRef.current = false;
      useWhepRef.current = preferWhep;
    }

    if (cancelledRef.current) return;

    clearReconnectTimer();
    cleanupStallRef.current?.();
    cleanupStallRef.current = null;
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

      // Create RTCPeerConnection — match go2rtc's video-rtc.js exactly
      if (typeof RTCPeerConnection === "undefined") {
        throw new Error("WebRTC no soportado en este navegador");
      }
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

      let videoAssigned = false;

      pc.onconnectionstatechange = () => {
        const connState = pc.connectionState;
        dbg(`[camstream] Camera ${cameraId} connection: ${connState}`);

        if (cancelledRef.current) return;

        if (connState === "connected" && !videoAssigned) {
          videoAssigned = true;
          useWhepRef.current = preferWhep; // reset signaling preference on success
          const tracks = pc
            .getTransceivers()
            .filter((tr) => tr.currentDirection === "recvonly")
            .map((tr) => tr.receiver.track);

          if (tracks.length > 0 && videoRef.current) {
            const stream = new MediaStream(tracks);
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) setHasAudio(true);

            videoRef.current.srcObject = stream;
            videoRef.current.muted = isMutedRef.current;
            videoRef.current.volume = volumeRef.current;

            videoRef.current.play().catch(() => {
              if (videoRef.current && !videoRef.current.muted) {
                videoRef.current.muted = true;
                videoRef.current.play().catch(() => {});
              }
            });

            dbg(`[camstream] Camera ${cameraId} video assigned (${tracks.length} tracks)`);

            if (wsRef.current) {
              dbg(`[camstream] Camera ${cameraId} closing WS (WebRTC connected)`);
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
            if (isFrozenRef.current) {
              isFrozenRef.current = false;
              setIsFrozen(false);
            }
          } else if (Date.now() - lastTimeChange > STALL_THRESHOLD_MS) {
            if (Date.now() - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;
            if (stateRef.current !== "playing") return;
            if (isFrozenRef.current) return;
            dbg(
              `[camstream] Camera ${cameraId} video stalled ${STALL_THRESHOLD_MS}ms (currentTime=${video.currentTime})`,
            );
            isFrozenRef.current = true;
            setIsFrozen(true);
            lastTimeChange = Date.now();
          }
        }, STALL_CHECK_MS);

        cleanupStallRef.current = () => {
          clearInterval(checkInterval);
        };
      }

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

      fallbackTimerRef.current = setTimeout(() => {
        fallbackTimerRef.current = null;
        if (stateRef.current !== "playing" && !cancelledRef.current) {
          markPlaying();
        }
      }, 5000);

      // Choose signaling method: WHEP for TV browsers, WebSocket for everything else.
      // If WebSocket failed previously, fall back to WHEP for subsequent retries.
      const useWhep = useWhepRef.current || !info.wsUrl;
      if (useWhep) {
        if (!info.whepUrl) {
          throw new Error("No WHEP URL provided by server");
        }
        await connectViaWhep(pc, info.whepUrl);
      } else {
        if (!info.wsUrl) {
          throw new Error("No WebSocket URL provided by server");
        }
        await connectViaWebSocket(pc, info.wsUrl);
      }
    } catch (err) {
      if (cancelledRef.current) return;
      const msg = err instanceof Error ? err.message : "Error al iniciar stream";
      console.error(`[camstream] Camera ${cameraId} connect error:`, msg);

      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (wsRef.current) { (wsRef.current as WebSocket).close(); wsRef.current = null; }

      // If sub stream keeps failing, switch to main on next retry
      if (streamTypeRef.current === "sub" && reconnectAttemptsRef.current >= MAX_FAST_ATTEMPTS) {
        dbg(`[camstream] Sub stream failed ${reconnectAttemptsRef.current} times — switching to main`);
        streamTypeRef.current = "main";
        reconnectAttemptsRef.current = 0;
      }

      if (isRetryableError(err)) {
        // WHEP/connection errors are usually transient — auto-retry
        if (reconnectAttemptsRef.current < MAX_FAST_ATTEMPTS) {
          const attempt = reconnectAttemptsRef.current + 1;
          reconnectAttemptsRef.current = attempt;
          const delay = Math.pow(2, attempt - 1) * 1000;
          setStateAndNotify("reconnecting");
          setErrorMsg(`Reintentando... (intento ${attempt}/${MAX_FAST_ATTEMPTS})`);
          scheduleReconnect(delay);
        } else {
          setStateAndNotify("offline");
          setErrorMsg("Cámara offline — reintentando cada 30s...");
          scheduleReconnect(POLL_INTERVAL_MS);
        }
      } else {
        setStateAndNotify("error");
        setErrorMsg(msg);
      }
    }
  }

  async function connectViaWebSocket(pc: RTCPeerConnection, wsUrl: string) {
    const wsConnectTS = Date.now();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      if (cancelledRef.current) return;
      dbg(`[camstream] Camera ${cameraId} WS open`);

      pc.createOffer().then((offer) => {
        return pc.setLocalDescription(offer);
      }).then(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "webrtc/offer",
            value: pc.localDescription!.sdp,
          }));
          dbg(`[camstream] Camera ${cameraId} offer sent via WS`);
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
        dbg(`[camstream] Camera ${cameraId} answer received`);
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
          dbgWarn(`[camstream] Camera ${cameraId} addIceCandidate error:`, err);
        });
      }

      if (msg.type === "error") {
        console.error(`[camstream] Camera ${cameraId} server error: ${msg.value}`);
        setStateAndNotify("error");
        setErrorMsg(msg.value);
      }
    });

    ws.addEventListener("close", () => {
      dbg(`[camstream] Camera ${cameraId} WS closed`);
      wsRef.current = null;
      // If WS closed before WebRTC connected, fall back to WHEP next time
      if (pc.connectionState !== "connected" && !cancelledRef.current) {
        useWhepRef.current = true;
        const delay = Math.max(RECONNECT_TIMEOUT_MS - (Date.now() - wsConnectTS), 0);
        scheduleReconnect(delay);
      }
    });

    ws.addEventListener("error", () => {
      console.error(`[camstream] Camera ${cameraId} WS error`);
      useWhepRef.current = true;
    });
  }

  async function connectViaWhep(pc: RTCPeerConnection, whepUrl: string) {
    dbg(`[camstream] Camera ${cameraId} connecting via WHEP: ${whepUrl}`);

    // Wait for ICE gathering to complete (non-trickle mode — best for TV browsers)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve, reject) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }
      const timeout = setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", check);
        reject(new Error("ICE gathering timeout"));
      }, 15000);
      const check = () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", check);
    });

    const res = await fetch(whepUrl, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: pc.localDescription!.sdp,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? `WHEP error ${res.status}`);
    }

    const sdpAnswer = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });
    dbg(`[camstream] Camera ${cameraId} WHEP answer set`);
  }

  const connectRef = useRef(connectInternal);
  connectRef.current = connectInternal;

  const connect = useCallback(() => connectRef.current(), []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (!next && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    volumeRef.current = clamped;
    if (clamped > 0) setIsMuted(false);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  // Auto-reconnect when frozen
  useEffect(() => {
    if (isFrozen && state === "playing") {
      const now = Date.now();
      if (now - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;

      frozenReconnectCountRef.current++;
      lastReconnectTimeRef.current = now;
      dbg(`[camstream] Camera ${cameraId} frozen — reconnecting (attempt ${frozenReconnectCountRef.current})`);

      if (frozenReconnectCountRef.current >= 3 && streamTypeRef.current === "sub") {
        dbg(`[camstream] Sub stream frozen 3 times — switching to main`);
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
      if (video && stateRef.current === "playing" && video.paused) {
        video.play().catch(() => {});
      }

      if (pc.connectionState === "connected" && video && stateRef.current === "playing") {
        // Stagger: random 1-8s delay to avoid 9 cameras reconnecting at once
        const delay = 1000 + Math.random() * 7000;
        fallbackTimerRef.current = setTimeout(() => {
          fallbackTimerRef.current = null;
          if (document.hidden) return;
          if (!videoRef.current || !pcRef.current) return;
          if (Date.now() - lastReconnectTimeRef.current < RECONNECT_COOLDOWN_MS) return;

          const currentVideo = videoRef.current;
          if (currentVideo && (currentVideo.readyState < 2 || currentVideo.paused)) {
            dbg(`[camstream] Camera ${cameraId} stale after background — refreshing`);
            lastReconnectTimeRef.current = Date.now();
            if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (wsRef.current) { (wsRef.current as WebSocket).close(); wsRef.current = null; }
            cleanupStallRef.current?.();
            currentVideo.srcObject = null;
            setStateAndNotify("reconnecting");
            setErrorMsg("Refrescando stream...");
            reconnectAttemptsRef.current = 0;
            setIsAutoRetrying(true);
            scheduleReconnect(1000);
          }
        }, delay);
      }
    };

    onVisibleOnce(cameraId, handleVisible);
    return () => {
      removeVisibleListener(cameraId);
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [cameraId, setStateAndNotify, scheduleReconnect]);

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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, WifiOff } from "lucide-react";

interface LiteCamera {
  id: string;
  name: string;
  siteName: string;
  hasSub: boolean;
}

interface LitePlayerProps {
  cameras: LiteCamera[];
}

/**
 * LitePlayer — minimal MSE viewer for low-end phones.
 *
 * 1 camera at a time, MSE via /api/cameras/[id]/mse, swipe navigation.
 * No WebRTC, no ICE, no filters, no recording — just viewing.
 */
export function LitePlayer({ cameras }: LitePlayerProps) {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMain, setUseMain] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const touchStartX = useRef(0);

  const camera = cameras[index];

  const playback = useCallback(
    async (camId: string, useMainStream: boolean) => {
      setLoading(true);
      setError(null);

      // Cleanup previous
      if (abortRef.current) abortRef.current.abort();
      if (mediaSourceRef.current) {
        try {
          mediaSourceRef.current.endOfStream();
        } catch {}
        mediaSourceRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.src = "";
      }

      const mseUrl = `/api/cameras/${camId}/mse?type=${useMainStream ? "main" : "sub"}`;

      try {
        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        if (videoRef.current) {
          videoRef.current.src = URL.createObjectURL(mediaSource);
        }

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            mediaSource.removeEventListener("sourceopen", onOpen);
            reject(new Error("MediaSource timeout"));
          }, 8000);

          const onOpen = async () => {
            clearTimeout(timeout);
            try {
              const mime =
                'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
              let sb: SourceBuffer;
              try {
                sb = mediaSource.addSourceBuffer(mime);
              } catch {
                sb = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
              }

              sb.mode = "segments";
              const controller = new AbortController();
              abortRef.current = controller;

              const res = await fetch(mseUrl, { signal: controller.signal });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);

              const reader = res.body!.getReader();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (sb.updating) {
                  await new Promise<void>((r) => {
                    const check = () => {
                      if (!sb.updating) { sb.removeEventListener("updateend", check); r(); }
                    };
                    sb.addEventListener("updateend", check);
                  });
                }
                sb.appendBuffer(value);
              }

              resolve();
            } catch (err) {
              reject(err);
            }
          };

          mediaSource.addEventListener("sourceopen", onOpen);
        });

        setLoading(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error";
        setError(msg);
        setLoading(false);
        // Auto-retry after 5s
        setTimeout(() => playback(camId, useMainStream), 5000);
      }
    },
    [],
  );

  // Start / change camera
  useEffect(() => {
    if (camera) {
      playback(camera.id, useMain);
    }
  }, [index, useMain, camera, playback]);

  // Swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) {
        if (diff > 0 && index < cameras.length - 1) setIndex((i) => i + 1);
        else if (diff < 0 && index > 0) setIndex((i) => i - 1);
      }
    },
    [index, cameras.length],
  );

  const next = useCallback(() => {
    if (index < cameras.length - 1) setIndex((i) => i + 1);
  }, [index, cameras.length]);

  const prev = useCallback(() => {
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  if (cameras.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-zinc-600 text-sm">Sin cámaras online</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black select-none touch-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Camera name */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent px-4 pt-3 pb-6">
        <p className="text-white text-sm font-semibold">{camera.name}</p>
        {camera.siteName && (
          <p className="text-white/50 text-[11px]">{camera.siteName}</p>
        )}
        <div className="flex gap-2 mt-1">
          <span className="text-zinc-500 text-[10px]">
            {useMain ? "Principal" : "Ligero"}
          </span>
          {camera.hasSub && (
            <button
              onClick={() => setUseMain((v) => !v)}
              className="text-zinc-400 text-[10px] underline"
            >
              {useMain ? "Usar sub" : "Usar main"}
            </button>
          )}
        </div>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />

      {/* Loading / Error overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <WifiOff className="w-8 h-8 text-red-400/60" />
          <p className="text-white/50 text-xs">Sin conexión — reintentando...</p>
        </div>
      )}

      {/* Navigation arrows */}
      {index > 0 && (
        <button
          onClick={prev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 text-white/30 hover:text-white/70 active:text-white transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {index < cameras.length - 1 && (
        <button
          onClick={next}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 text-white/30 hover:text-white/70 active:text-white transition-colors"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-10">
        {cameras.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={[
              "h-1.5 rounded-full transition-all",
              i === index ? "w-4 bg-white/60" : "w-1.5 bg-white/20",
            ].join(" ")}
            aria-label={`Cámara ${i + 1}`}
          />
        ))}
      </div>

      {/* Retry button (on error) */}
      {error && !loading && (
        <button
          onClick={() => playback(camera.id, useMain)}
          className={[
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20",
            "px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm",
            "hover:bg-white/20 active:bg-white/30 transition-all",
            error ? "block" : "hidden",
          ].join(" ")}
        >
          <Play className="w-5 h-5 inline mr-1" /> Reintentar
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, WifiOff, LayoutGrid, LayoutList } from "lucide-react";

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
 * MSE stream manager for a single camera.
 * Returns { videoRef, error, loading, retry }.
 */
function useMseStream(cameraId: string, useMain: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const startStream = useCallback(() => {
    setLoading(true);
    setError(null);

    if (abortRef.current) abortRef.current.abort();
    if (mediaSourceRef.current) {
      try { mediaSourceRef.current.endOfStream(); } catch {}
      mediaSourceRef.current = null;
    }
    if (videoRef.current) videoRef.current.src = "";

    const mseUrl = `/api/cameras/${cameraId}/mse?type=${useMain ? "main" : "sub"}`;

    (async () => {
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
              let sb: SourceBuffer;
              try {
                sb = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
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
        retryTimerRef.current = setTimeout(startStream, 5000);
      }
    })();
  }, [cameraId, useMain]);

  useEffect(() => {
    startStream();
    return () => {
      clearTimeout(retryTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [startStream]);

  return { videoRef, error, loading, retry: startStream };
}

/**
 * LitePlayer — minimal MSE viewer for low-end phones.
 *
 * Single view: 1 camera full-screen.
 * Double view: 2 cameras side-by-side (tap to toggle).
 * Swipe left/right to navigate.
 * No WebRTC, no ICE, no filters, no recording — just viewing.
 */
export function LitePlayer({ cameras }: LitePlayerProps) {
  const [index, setIndex] = useState(0);
  const [gridMode, setGridMode] = useState(false);
  const [useMain, setUseMain] = useState(false);
  const touchStartX = useRef(0);

  const steps = gridMode ? 2 : 1;
  const maxIndex = cameras.length - steps + 1;

  const visibleCameras = gridMode
    ? cameras.slice(index, index + 2)
    : [cameras[index]];

  const next = useCallback(() => {
    if (index < maxIndex - 1) setIndex((i) => i + steps);
  }, [index, maxIndex, steps]);

  const prev = useCallback(() => {
    if (index > 0) setIndex((i) => i - steps);
  }, [index, steps]);

  // Swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) {
        if (diff > 0 && index < maxIndex - 1) setIndex((i) => i + steps);
        else if (diff < 0 && index > 0) setIndex((i) => i - steps);
      }
    },
    [index, maxIndex, steps],
  );

  if (cameras.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-zinc-600 text-sm">Sin cámaras online</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent px-4 pt-3 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">
              {gridMode
                ? `${visibleCameras.map((c) => c.name).join(" · ")}`
                : visibleCameras[0]?.name}
            </p>
            <p className="text-white/50 text-[11px] flex items-center gap-2">
              {useMain ? "Principal" : "Ligero"}
              {visibleCameras[0]?.hasSub && (
                <button
                  onClick={() => setUseMain((v) => !v)}
                  className="text-zinc-400 underline"
                >
                  {useMain ? "Usar sub" : "Usar main"}
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/* Grid toggle */}
            {cameras.length > 1 && (
              <button
                onClick={() => { setGridMode((v) => !v); setIndex(0); }}
                className="p-2 rounded-full bg-black/40 text-white/60 hover:text-white transition-colors"
                aria-label={gridMode ? "Una cámara" : "Dos cámaras"}
                title={gridMode ? "Una cámara" : "Dos cámaras"}
              >
                {gridMode ? <LayoutList className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video grid */}
      <div className={`w-full h-full ${gridMode ? "flex flex-row" : ""}`}>
        {visibleCameras.map((cam) => (
          <MseVideoCard key={cam.id} camera={cam} useMain={useMain} />
        ))}
      </div>

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
      {index < maxIndex - 1 && (
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
        {Array.from({ length: Math.ceil(cameras.length / steps) }).map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i * steps)}
            className={[
              "h-1.5 rounded-full transition-all",
              i === Math.floor(index / steps) ? "w-4 bg-white/60" : "w-1.5 bg-white/20",
            ].join(" ")}
            aria-label={`Página ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Single MSE video card */
function MseVideoCard({ camera, useMain }: { camera: LiteCamera; useMain: boolean }) {
  const { videoRef, error, loading, retry } = useMseStream(camera.id, useMain);

  return (
    <div className="relative flex-1 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <WifiOff className="w-8 h-8 text-red-400/60" />
          <p className="text-white/50 text-xs text-center px-4">{camera.name}</p>
          <button
            onClick={retry}
            className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-all inline-flex items-center gap-1"
          >
            <Play className="w-4 h-4" /> Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

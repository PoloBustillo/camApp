"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Calendar, Clock, Film, Play, Download, Trash2, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { Recording } from "@/types";

interface CameraOption {
  id: string;
  name: string;
}

interface Props {
  cameras: CameraOption[];
  initialRecordings: Recording[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "--";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function RecordingsPageClient({ cameras, initialRecordings }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameraId, setCameraId] = useState(searchParams.get("cameraId") || "");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordings, setRecordings] = useState<Recording[]>(initialRecordings);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cameraId) params.set("cameraId", cameraId);
      if (selectedDate) params.set("date", selectedDate);
      params.set("limit", "100");

      const res = await fetch(`/api/recordings?${params}`);
      if (!res.ok) throw new Error("Error al cargar grabaciones");
      const json = await res.json();
      setRecordings(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [cameraId, selectedDate]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/recordings", { method: "POST" });
      if (!res.ok) throw new Error("Error al sincronizar");
      const json = await res.json();
      setSyncMsg(`${json.data.synced} grabaciones nuevas sincronizadas`);
      await fetchRecordings();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : "Error de sincronización");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  const handleDelete = async (rec: Recording) => {
    if (!confirm(`¿Eliminar grabación de ${formatDate(rec.startTime)}?`)) return;
    try {
      const res = await fetch(`/api/recordings/${rec.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
      if (selectedRecording?.id === rec.id) setSelectedRecording(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRecordings = recordings.filter((r) => {
    if (cameraId && r.cameraId !== cameraId) return false;
    if (selectedDate && r.date.slice(0, 10) !== selectedDate) return false;
    return true;
  });

  const streamUrl = selectedRecording
    ? `/api/recordings/${selectedRecording.id}`
    : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Cámara</label>
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas las cámaras</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Fecha</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="h-9 px-4 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>

        {syncMsg && (
          <span className="text-xs text-muted-foreground">{syncMsg}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recording list */}
        <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && filteredRecordings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Film className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Sin grabaciones</p>
              <p className="text-xs">Prueba otra fecha o sincroniza desde la PC</p>
            </div>
          )}

          {!loading && filteredRecordings.map((rec) => (
            <button
              key={rec.id}
              type="button"
              onClick={() => setSelectedRecording(rec)}
              className={[
                "w-full text-left p-3 rounded-lg border transition-colors",
                selectedRecording?.id === rec.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{rec.cameraName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatTime(rec.startTime)}
                    {rec.duration && <span className="ml-2">· {formatDuration(rec.duration)}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(rec.startTime)} · {formatFileSize(rec.fileSize)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(rec); }}
                  className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </button>
          ))}
        </div>

        {/* Video player */}
        <div className="lg:col-span-2">
          {selectedRecording && streamUrl ? (
            <div className="rounded-xl overflow-hidden border border-border bg-black">
              <video
                ref={videoRef}
                controls
                autoPlay
                className="w-full aspect-video"
                key={streamUrl}
              >
                <source src={streamUrl} type="video/mp4" />
              </video>
              <div className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedRecording.cameraName}
                </h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(selectedRecording.startTime)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(selectedRecording.startTime)}
                    {selectedRecording.duration && <> · {formatDuration(selectedRecording.duration)}</>}
                  </span>
                  <a
                    href={streamUrl}
                    download={selectedRecording.fileName}
                    className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Play className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Selecciona una grabación para reproducir</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

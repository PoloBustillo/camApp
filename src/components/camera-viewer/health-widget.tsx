"use client";

import { useEffect, useState, useCallback } from "react";

interface CameraHealthStats {
  total: number;
  online: number;
  offline: number;
  lastUpdated: Date;
}

interface HealthWidgetProps {
  initial: CameraHealthStats;
  pollInterval?: number;
}

/**
 * Compact health stats bar — single row, minimal footprint.
 * Shows total/online/offline at a glance without dominating the page.
 */
export function HealthWidget({ initial, pollInterval = 30_000 }: HealthWidgetProps) {
  const [stats, setStats] = useState<CameraHealthStats>(initial);
  const [updating, setUpdating] = useState(false);

  const refresh = useCallback(async () => {
    setUpdating(true);
    try {
      const res = await fetch("/api/cameras?limit=200&enabled=true");
      if (res.ok) {
        const json = await res.json();
        const cameras = json.data ?? [];
        setStats({
          total: cameras.length,
          online: cameras.filter((c: { online: boolean }) => c.online).length,
          offline: cameras.filter((c: { online: boolean }) => !c.online).length,
          lastUpdated: new Date(),
        });
      }
    } finally {
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, pollInterval);
    return () => clearInterval(id);
  }, [refresh, pollInterval]);

  const uptime = stats.total > 0
    ? Math.round((stats.online / stats.total) * 100)
    : 0;

  return (
    <div className="flex items-center gap-4 px-1">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-zinc-500" />
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{stats.total}</span> cámaras
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-green-600">{stats.online}</span> online
        </span>
      </div>
      {stats.offline > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-red-500">{stats.offline}</span> offline
          </span>
        </div>
      )}
      <div className={`text-xs font-medium ml-auto ${uptime >= 80 ? "text-green-500" : uptime >= 50 ? "text-yellow-500" : "text-red-500"}`}>
        {updating ? "↻" : `${uptime}%`}
      </div>
    </div>
  );
}


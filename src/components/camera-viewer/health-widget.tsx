"use client";

import { useEffect, useState, useCallback } from "react";

interface CameraHealthStats {
  total: number;
  online: number;
  offline: number;
  lastUpdated: Date;
}

interface HealthWidgetProps {
  /** Initial stats passed from server */
  initial: CameraHealthStats;
  /** Polling interval ms (default 30000) */
  pollInterval?: number;
}

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

  const uptime =
    stats.total > 0
      ? Math.round((stats.online / stats.total) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label="Total" value={stats.total} icon="📷" color="text-foreground" />
      <StatCard label="Online" value={stats.online} icon="🟢" color="text-green-500" />
      <StatCard label="Offline" value={stats.offline} icon="🔴" color="text-red-500" />
      <StatCard
        label="Uptime"
        value={`${uptime}%`}
        icon={updating ? "⟳" : "📊"}
        color={
          uptime >= 80
            ? "text-green-500"
            : uptime >= 50
              ? "text-yellow-500"
              : "text-red-500"
        }
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border px-4 py-3 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

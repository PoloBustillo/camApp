"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type MediaMtxServer = {
  id: string;
  name: string;
  baseUrl: string;
  apiUrl: string;
  enabled: boolean;
  _count: { cameras: number };
};

type PathItem = {
  name: string;
  ready: boolean;
  readyTime: string | null;
};

type Site = {
  id: string;
  name: string;
};

type TestResult = {
  ok: boolean;
  latencyMs: number;
  streamCount?: number;
  error?: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  cameras: { id: string; name: string }[];
};

export default function DiscoveryPage() {
  const searchParams = useSearchParams();
  const preselectedServerId = searchParams.get("serverId");

  const [servers, setServers] = useState<MediaMtxServer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingTest, setLoadingTest] = useState(false);
  const [loadingPaths, setLoadingPaths] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [pathsError, setPathsError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Load servers and sites on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/mediamtx-servers").then((r) => r.json()),
      fetch("/api/sites").then((r) => r.json()),
    ]).then(([serversJson, sitesJson]) => {
      const serverList: MediaMtxServer[] = serversJson.data ?? [];
      setServers(serverList);
      setSites(sitesJson.data ?? []);

      // Preselect server from query param
      if (preselectedServerId) {
        const found = serverList.find((s) => s.id === preselectedServerId);
        if (found) setSelectedServerId(found.id);
      } else if (serverList.length === 1) {
        setSelectedServerId(serverList[0].id);
      }
    }).catch(console.error).finally(() => setLoadingServers(false));
  }, [preselectedServerId]);

  const handleTest = useCallback(async () => {
    if (!selectedServerId) return;
    setLoadingTest(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/mediamtx-servers/${selectedServerId}/test`, {
        method: "POST",
      });
      const json = await res.json();
      setTestResult(json.data);
    } catch {
      setTestResult({ ok: false, latencyMs: 0, error: "Request failed" });
    } finally {
      setLoadingTest(false);
    }
  }, [selectedServerId]);

  const handleFetchPaths = useCallback(async () => {
    if (!selectedServerId) return;
    setLoadingPaths(true);
    setPathsError(null);
    setPaths([]);
    setSelectedPaths(new Set());
    setImportResult(null);
    try {
      const res = await fetch(`/api/mediamtx-servers/${selectedServerId}/paths`);
      const json = await res.json();
      if (res.ok) {
        setPaths(json.data?.paths ?? []);
      } else {
        setPathsError(json.error?.message ?? "Error al obtener paths");
      }
    } catch {
      setPathsError("Error de conexión");
    } finally {
      setLoadingPaths(false);
    }
  }, [selectedServerId]);

  function togglePath(name: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll() {
    setSelectedPaths(new Set(paths.map((p) => p.name)));
  }

  function deselectAll() {
    setSelectedPaths(new Set());
  }

  async function handleImport() {
    if (selectedPaths.size === 0 || !selectedServerId) return;
    setLoadingImport(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch(`/api/mediamtx-servers/${selectedServerId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId || undefined,
          paths: Array.from(selectedPaths).map((name) => ({ name })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setImportResult(json.data);
      } else {
        setImportError(json.error?.message ?? "Error al importar");
      }
    } catch {
      setImportError("Error de conexión");
    } finally {
      setLoadingImport(false);
    }
  }

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const inputCls =
    "w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/cameras"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Volver
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Descubrimiento de Cámaras</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecta con un servidor MediaMTX y descubre los streams disponibles
          </p>
        </div>
      </div>

      {/* Step 1: Select server */}
      <section className="border border-border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            1
          </span>
          Seleccionar servidor MediaMTX
        </h2>

        {loadingServers ? (
          <p className="text-sm text-muted-foreground">Cargando servidores…</p>
        ) : servers.length === 0 ? (
          <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
            No hay servidores registrados.{" "}
            <Link href="/cameras" className="underline text-foreground">
              Agrega uno primero
            </Link>
            .
          </div>
        ) : (
          <select
            value={selectedServerId}
            onChange={(e) => {
              setSelectedServerId(e.target.value);
              setTestResult(null);
              setPaths([]);
              setSelectedPaths(new Set());
              setImportResult(null);
            }}
            className={inputCls}
          >
            <option value="">-- Selecciona un servidor --</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.apiUrl}
              </option>
            ))}
          </select>
        )}

        {selectedServer && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-3 space-y-1">
            <div>
              <span className="font-medium">Base URL:</span> {selectedServer.baseUrl}
            </div>
            <div>
              <span className="font-medium">API URL:</span> {selectedServer.apiUrl}
            </div>
            <div>
              <span className="font-medium">Cámaras importadas:</span>{" "}
              {selectedServer._count.cameras}
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Test connection */}
      <section className="border border-border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            2
          </span>
          Probar conexión
        </h2>

        <button
          onClick={handleTest}
          disabled={!selectedServerId || loadingTest}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loadingTest ? "Probando…" : "Probar Conexión"}
        </button>

        {testResult && (
          <div
            className={`flex items-center gap-3 p-3 rounded-md text-sm ${
              testResult.ok
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <span className={`text-lg ${testResult.ok ? "text-green-500" : "text-red-500"}`}>
              {testResult.ok ? "✓" : "✗"}
            </span>
            <div>
              {testResult.ok ? (
                <>
                  Conectado correctamente — <strong>{testResult.latencyMs}ms</strong> latencia —{" "}
                  <strong>{testResult.streamCount ?? 0}</strong> streams activos
                </>
              ) : (
                <>Error: {testResult.error}</>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Step 3: Fetch paths */}
      <section className="border border-border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            3
          </span>
          Buscar Paths disponibles
        </h2>

        <button
          onClick={handleFetchPaths}
          disabled={!selectedServerId || loadingPaths}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loadingPaths ? "Buscando…" : "Buscar Paths"}
        </button>

        {pathsError && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {pathsError}
          </div>
        )}

        {paths.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {paths.length} path{paths.length !== 1 ? "s" : ""} encontrado{paths.length !== 1 ? "s" : ""} —{" "}
                <span className="text-foreground font-medium">{selectedPaths.size}</span> seleccionado
                {selectedPaths.size !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Seleccionar todo
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Deseleccionar todo
                </button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="w-10 px-4 py-2"></th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Path</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {paths.map((path, i) => (
                    <tr
                      key={path.name}
                      className={`cursor-pointer hover:bg-muted/30 transition-colors ${
                        i % 2 === 0 ? "bg-background" : "bg-muted/20"
                      } ${selectedPaths.has(path.name) ? "ring-1 ring-inset ring-primary/30" : ""}`}
                      onClick={() => togglePath(path.name)}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedPaths.has(path.name)}
                          onChange={() => togglePath(path.name)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{path.name}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${
                            path.ready ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              path.ready ? "bg-green-500" : "bg-red-400"
                            }`}
                          />
                          {path.ready ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {path.readyTime
                          ? new Date(path.readyTime).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {paths.length === 0 && !loadingPaths && !pathsError && selectedServerId && (
          <p className="text-sm text-muted-foreground">
            Haz clic en &quot;Buscar Paths&quot; para ver los streams disponibles.
          </p>
        )}
      </section>

      {/* Step 4: Import */}
      <section className="border border-border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            4
          </span>
          Importar cámaras seleccionadas
        </h2>

        <div>
          <label className="block text-sm font-medium mb-1">
            Sitio (opcional)
          </label>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className={inputCls}
          >
            <option value="">Sin sitio asignado</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Puedes asignar el sitio más tarde editando cada cámara.
          </p>
        </div>

        <button
          onClick={handleImport}
          disabled={selectedPaths.size === 0 || loadingImport}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loadingImport
            ? "Importando…"
            : `Importar ${selectedPaths.size} path${selectedPaths.size !== 1 ? "s" : ""} seleccionado${selectedPaths.size !== 1 ? "s" : ""}`}
        </button>

        {importError && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {importError}
          </div>
        )}

        {importResult && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
            <p className="font-medium text-green-800">
              ✓ Importación completada
            </p>
            <p className="text-sm text-green-700">
              <strong>{importResult.imported}</strong> cámara{importResult.imported !== 1 ? "s" : ""}{" "}
              importada{importResult.imported !== 1 ? "s" : ""},{" "}
              <strong>{importResult.skipped}</strong> omitida{importResult.skipped !== 1 ? "s" : ""}{" "}
              (ya existían)
            </p>
            {importResult.cameras.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-green-700 mb-1">Cámaras creadas:</p>
                <ul className="text-xs text-green-600 space-y-0.5 font-mono">
                  {importResult.cameras.map((c) => (
                    <li key={c.id}>— {c.name}</li>
                  ))}
                </ul>
              </div>
            )}
            <Link
              href="/cameras"
              className="inline-block mt-2 text-sm text-green-700 underline hover:text-green-900"
            >
              Ver cámaras →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

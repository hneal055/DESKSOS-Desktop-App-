import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ProcessEntry {
  name: string;
  pid: number;
  wsMB: number;
  pvtMB: number;
  threads: number;
  cpu: number;
}

interface BrowserEntry {
  browser: string;
  count: number;
  totalMB: number;
}

interface MemoryData {
  procs: ProcessEntry[];
  totalMB: number;
  freeMB: number;
  browsers: BrowserEntry[];
}

const MEMORY_CMD =
  `$p=@(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 | ` +
  `Select-Object @{n='name';e={$_.ProcessName}},@{n='pid';e={$_.Id}},` +
  `@{n='wsMB';e={[math]::Round($_.WorkingSet64/1MB,1)}},` +
  `@{n='pvtMB';e={[math]::Round($_.PrivateMemorySize64/1MB,1)}},` +
  `@{n='threads';e={$_.Threads.Count}},` +
  `@{n='cpu';e={[math]::Round([double]$_.CPU,1)}});` +

  `$os=Get-CimInstance Win32_OperatingSystem;` +
  `$totMB=[math]::Round($os.TotalVisibleMemorySize/1024,0);` +
  `$freMB=[math]::Round($os.FreePhysicalMemory/1024,0);` +

  `$bn=@('chrome','firefox','msedge','iexplore','opera','brave','vivaldi');` +
  `$b=@($bn | ForEach-Object {` +
  `$n=$_;$pr=@(Get-Process -Name $n -EA SilentlyContinue);` +
  `if($pr.Count -gt 0){[PSCustomObject]@{browser=$n;count=$pr.Count;` +
  `totalMB=[math]::Round(($pr | Measure-Object WorkingSet64 -Sum).Sum/1MB,0)}}});` +

  `@{procs=$p;totalMB=[int]$totMB;freeMB=[int]$freMB;browsers=$b} | ConvertTo-Json -Depth 3 -Compress`;

const toArr = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? v : v ? [v as T] : [];

const BROWSER_ICONS: Record<string, string> = {
  chrome: "🌐",
  firefox: "🦊",
  msedge: "🔵",
  iexplore: "🔷",
  opera: "🔴",
  brave: "🦁",
  vivaldi: "🎻",
};

export default function MemoryConsumers() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: MEMORY_CMD });
      const p = JSON.parse(raw.trim());
      setData({
        procs: toArr<ProcessEntry>(p.procs),
        totalMB: p.totalMB ?? 0,
        freeMB: p.freeMB ?? 0,
        browsers: toArr<BrowserEntry>(p.browsers),
      });
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  const derived = useMemo(() => {
    if (!data) return null;
    const usedMB = data.totalMB - data.freeMB;
    const usedPct = data.totalMB > 0 ? Math.round((usedMB / data.totalMB) * 100) : 0;
    const maxWS = data.procs[0]?.wsMB ?? 1;
    return { usedMB, usedPct, maxWS };
  }, [data]);

  const memBarColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 75) return "bg-yellow-500";
    return "bg-blue-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🧠 Memory Consumers</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition disabled:opacity-50"
        >
          {loading ? "⏳ Loading..." : "🔄 Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400">
          ❌ {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16 text-gray-400">⏳ Reading process memory...</div>
      )}

      {data && derived && (
        <>
          {/* Memory summary */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-4">System Memory</h3>
            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">
                  {(data.totalMB / 1024).toFixed(1)} GB
                </div>
                <div className="text-gray-500 text-xs">Total</div>
              </div>
              <div>
                <div
                  className={`text-2xl font-bold ${
                    derived.usedPct >= 90
                      ? "text-red-400"
                      : derived.usedPct >= 75
                      ? "text-yellow-400"
                      : "text-blue-400"
                  }`}
                >
                  {(derived.usedMB / 1024).toFixed(1)} GB
                </div>
                <div className="text-gray-500 text-xs">Used ({derived.usedPct}%)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {(data.freeMB / 1024).toFixed(1)} GB
                </div>
                <div className="text-gray-500 text-xs">Free</div>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all ${memBarColor(derived.usedPct)}`}
                style={{ width: `${derived.usedPct}%` }}
              />
            </div>
            {derived.usedPct >= 90 && (
              <div className="text-red-400 text-xs mt-2">
                ⚠️ Memory is critically full — system may be paging to disk
              </div>
            )}
          </div>

          {/* Top 15 by Working Set */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-bold text-purple-400 mb-5">
              Top Processes by Memory
            </h3>
            {data.procs.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">No process data.</div>
            ) : (
              <div className="space-y-3">
                {data.procs.map((p, i) => {
                  const barPct = Math.round((p.wsMB / derived.maxWS) * 100);
                  const pvtPct = Math.round((p.pvtMB / derived.maxWS) * 100);
                  return (
                    <div key={i}>
                      <div className="flex items-baseline justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-500 text-xs w-4 text-right shrink-0">
                            {i + 1}.
                          </span>
                          <span className="text-gray-200 text-sm font-mono truncate">{p.name}</span>
                          <span className="text-gray-600 text-xs shrink-0">PID {p.pid}</span>
                        </div>
                        <div className="text-right shrink-0 text-xs text-gray-400 space-x-3">
                          <span className="text-purple-400 font-semibold">
                            {p.wsMB.toFixed(0)} MB
                          </span>
                          <span className="text-gray-600">pvt {p.pvtMB.toFixed(0)}</span>
                          {p.cpu > 0 && (
                            <span className="text-yellow-500">{p.cpu.toFixed(1)}s CPU</span>
                          )}
                          <span className="text-gray-600">{p.threads}t</span>
                        </div>
                      </div>
                      {/* Stacked bar: private underneath, total on top */}
                      <div className="w-full bg-gray-700 rounded-full h-2 relative">
                        <div
                          className="h-2 rounded-full bg-gray-600 absolute left-0"
                          style={{ width: `${pvtPct}%` }}
                        />
                        <div
                          className="h-2 rounded-full bg-purple-500 opacity-60 absolute left-0"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="text-gray-600 text-xs pt-2">
                  Bar: working set (total) · darker fill: private (non-shared)
                </div>
              </div>
            )}
          </div>

          {/* Browser memory */}
          {data.browsers.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Browser Memory Usage</h3>
              <div className="space-y-3">
                {data.browsers.map((b, i) => {
                  const pct = Math.round(
                    (b.totalMB / (data.totalMB || 1)) * 100
                  );
                  return (
                    <div key={i} className="bg-gray-700 rounded-lg p-4 flex items-center gap-4">
                      <span className="text-2xl shrink-0">
                        {BROWSER_ICONS[b.browser] ?? "🌐"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-gray-200 font-semibold capitalize">
                            {b.browser === "msedge" ? "Microsoft Edge" : b.browser}
                          </span>
                          <span className="text-cyan-400 font-bold">
                            {b.totalMB.toLocaleString()} MB
                          </span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-1.5 mb-1">
                          <div
                            className="h-1.5 rounded-full bg-cyan-500"
                            style={{ width: `${Math.min(pct * 3, 100)}%` }}
                          />
                        </div>
                        <div className="text-gray-500 text-xs">
                          {b.count} {b.count === 1 ? "process" : "processes"} · {pct}% of system RAM
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.browsers.length === 0 && (
            <div className="bg-gray-800 rounded-lg p-4 text-gray-600 text-sm text-center">
              No browser processes detected.
            </div>
          )}
        </>
      )}
    </div>
  );
}

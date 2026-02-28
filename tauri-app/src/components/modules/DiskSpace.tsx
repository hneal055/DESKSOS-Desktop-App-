import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DriveInfo {
  drive: string;
  label: string;
  used: number;
  free: number;
  total: number;
}

interface DiskPerf {
  name: string;
  readMBps: number;
  writeMBps: number;
  queueLength: number;
  pctTime: number;
}

interface FolderSize {
  path: string;
  sizeGB: number;
  sizeMB: number;
}

const formatSize = (gb: number): string => {
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = gb * 1024;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.round(mb * 1024)} KB`;
};

const DRIVES_CMD =
  `@(Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ` +
  `Select-Object @{n='drive';e={$_.Name}},@{n='label';e={$_.Description}},` +
  `@{n='used';e={[math]::Round($_.Used/1GB,2)}},` +
  `@{n='free';e={[math]::Round($_.Free/1GB,2)}},` +
  `@{n='total';e={[math]::Round(($_.Used+$_.Free)/1GB,2)}}) | ConvertTo-Json -Compress`;

const PERF_CMD =
  `@(try{Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk | ` +
  `Where-Object {$_.Name -match '^[A-Z]:$'} | ` +
  `Select-Object @{n='name';e={$_.Name}},` +
  `@{n='readMBps';e={[math]::Round([double]$_.DiskReadBytesPersec/1MB,2)}},` +
  `@{n='writeMBps';e={[math]::Round([double]$_.DiskWriteBytesPersec/1MB,2)}},` +
  `@{n='queueLength';e={[math]::Round([double]$_.AvgDiskQueueLength,2)}},` +
  `@{n='pctTime';e={[math]::Round([math]::Min([double]$_.PercentDiskTime,100),1)}}}` +
  `catch{@()}) | ConvertTo-Json -Compress`;

const FOLDERS_CMD =
  `$drive=$env:SystemDrive+'\\';` +
  `$f=@(Get-ChildItem -Path $drive -Directory -ErrorAction SilentlyContinue | ` +
  `ForEach-Object {` +
  `$sz=[double](Get-ChildItem -Path $_.FullName -Recurse -File -ErrorAction SilentlyContinue | ` +
  `Measure-Object Length -Sum).Sum;` +
  `[PSCustomObject]@{path=$_.FullName;sizeGB=[math]::Round($sz/1GB,2);sizeMB=[math]::Round($sz/1MB,0)}` +
  `} | Sort-Object sizeGB -Descending | Select-Object -First 10);` +
  `$f | ConvertTo-Json -Compress`;

const toArray = <T,>(parsed: T | T[]): T[] =>
  Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];

export default function DiskSpace() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [perf, setPerf] = useState<DiskPerf[]>([]);
  const [folders, setFolders] = useState<FolderSize[]>([]);

  const [loadingDrives, setLoadingDrives] = useState(false);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const [driveError, setDriveError] = useState<string | null>(null);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderScanned, setFolderScanned] = useState(false);

  useEffect(() => {
    loadDrives();
    loadPerf();
  }, []);

  const loadDrives = async () => {
    setLoadingDrives(true);
    setDriveError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: DRIVES_CMD });
      setDrives(toArray(JSON.parse(raw.trim())));
    } catch (err) {
      setDriveError(`${err}`);
    } finally {
      setLoadingDrives(false);
    }
  };

  const loadPerf = async () => {
    setLoadingPerf(true);
    setPerfError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: PERF_CMD });
      setPerf(toArray(JSON.parse(raw.trim())));
    } catch (err) {
      setPerfError(`${err}`);
    } finally {
      setLoadingPerf(false);
    }
  };

  const scanFolders = async () => {
    setLoadingFolders(true);
    setFolderError(null);
    setFolders([]);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: FOLDERS_CMD });
      setFolders(toArray(JSON.parse(raw.trim())));
      setFolderScanned(true);
    } catch (err) {
      setFolderError(`${err}`);
    } finally {
      setLoadingFolders(false);
    }
  };

  const usedPct = (used: number, total: number) =>
    total > 0 ? Math.round((used / total) * 100) : 0;

  const barColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 75) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const criticalDrives = drives.filter((d) => usedPct(d.used, d.total) >= 90);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🗂️ Disk Space</h2>
        <button
          type="button"
          onClick={() => { loadDrives(); loadPerf(); }}
          disabled={loadingDrives || loadingPerf}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Critical Warnings */}
      {criticalDrives.length > 0 && (
        <div className="space-y-2">
          {criticalDrives.map((d) => {
            const pct = usedPct(d.used, d.total);
            return (
              <div
                key={d.drive}
                className="bg-red-900/40 border border-red-600 rounded-lg p-4 flex items-center gap-3"
              >
                <span className="text-2xl">🚨</span>
                <div>
                  <div className="text-red-400 font-bold">
                    Drive {d.drive}: is critically full ({pct}% used)
                  </div>
                  <div className="text-red-300/80 text-sm">
                    Only {formatSize(d.free)} free of {formatSize(d.total)} total
                    {d.label ? ` — ${d.label}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All Drives */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-400 mb-5">📊 All Drives</h3>
        {loadingDrives ? (
          <div className="text-gray-400 text-center py-4">⏳ Loading drives...</div>
        ) : driveError ? (
          <div className="text-red-400 text-sm">{driveError}</div>
        ) : drives.length === 0 ? (
          <div className="text-gray-500">No drives found.</div>
        ) : (
          <div className="space-y-5">
            {drives.map((vol) => {
              const pct = usedPct(vol.used, vol.total);
              return (
                <div key={vol.drive}>
                  <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold font-mono text-lg">{vol.drive}:</span>
                      {vol.label && (
                        <span className="text-gray-400 text-sm">{vol.label}</span>
                      )}
                      {pct >= 90 && (
                        <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">
                          CRITICAL
                        </span>
                      )}
                      {pct >= 75 && pct < 90 && (
                        <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded-full">
                          LOW
                        </span>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <span
                        className={
                          pct >= 90
                            ? "text-red-400 font-bold"
                            : pct >= 75
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }
                      >
                        {pct}% used
                      </span>
                      <span className="text-gray-500 ml-3">
                        {formatSize(vol.free)} free of {formatSize(vol.total)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${barColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatSize(vol.used)} used</span>
                    <span>{formatSize(vol.free)} free</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disk Performance */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-green-400 mb-4">⚡ Disk Performance</h3>
        {loadingPerf ? (
          <div className="text-gray-400 text-center py-4">⏳ Loading performance metrics...</div>
        ) : perfError ? (
          <div className="text-red-400 text-sm">{perfError}</div>
        ) : perf.length === 0 ? (
          <div className="text-gray-500 text-sm">Performance data unavailable on this system.</div>
        ) : (
          <div className="space-y-3">
            {perf.map((p) => {
              const queueHigh = p.queueLength > 2;
              const busyHigh = p.pctTime > 80;
              return (
                <div key={p.name} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-mono font-bold">{p.name}</span>
                    {(queueHigh || busyHigh) && (
                      <span className="text-xs bg-yellow-700 text-yellow-200 px-2 py-0.5 rounded">
                        ⚠️ High Load
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                    <div className="bg-gray-600 rounded p-2 text-center">
                      <div className="text-blue-400 font-semibold text-base">
                        {p.readMBps.toFixed(1)}
                      </div>
                      <div className="text-gray-400 text-xs">MB/s Read</div>
                    </div>
                    <div className="bg-gray-600 rounded p-2 text-center">
                      <div className="text-purple-400 font-semibold text-base">
                        {p.writeMBps.toFixed(1)}
                      </div>
                      <div className="text-gray-400 text-xs">MB/s Write</div>
                    </div>
                    <div className="bg-gray-600 rounded p-2 text-center">
                      <div
                        className={`font-semibold text-base ${
                          queueHigh ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {p.queueLength.toFixed(1)}
                      </div>
                      <div className="text-gray-400 text-xs">Queue Length</div>
                    </div>
                    <div className="bg-gray-600 rounded p-2 text-center">
                      <div
                        className={`font-semibold text-base ${
                          busyHigh ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {p.pctTime.toFixed(0)}%
                      </div>
                      <div className="text-gray-400 text-xs">% Busy</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-gray-600 text-xs">
              Snapshot at time of load — refresh for current values.
              Queue &gt; 2 or Busy &gt; 80% may indicate a disk bottleneck.
            </div>
          </div>
        )}
      </div>

      {/* Top 10 Largest Folders */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-yellow-400">📁 Top 10 Largest Folders</h3>
          <button
            type="button"
            onClick={scanFolders}
            disabled={loadingFolders}
            className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-lg text-sm transition font-semibold"
          >
            {loadingFolders ? "⏳ Scanning..." : folderScanned ? "🔄 Re-scan" : "🔍 Scan System Drive"}
          </button>
        </div>

        {!folderScanned && !loadingFolders && (
          <div className="text-center py-8">
            <div className="text-gray-500 text-sm">
              Click "Scan System Drive" to find the top 10 largest folders on {`%SystemDrive%`}.
            </div>
            <div className="text-gray-600 text-xs mt-1">
              This scan may take 1–3 minutes depending on drive size.
            </div>
          </div>
        )}

        {loadingFolders && (
          <div className="text-center py-8">
            <div className="text-yellow-400 text-lg mb-2">⏳ Scanning folder sizes...</div>
            <div className="text-gray-500 text-sm">
              Walking all subdirectories — this may take 1–3 minutes.
            </div>
          </div>
        )}

        {folderError && (
          <div className="text-red-400 text-sm mt-2">{folderError}</div>
        )}

        {folderScanned && !loadingFolders && folders.length === 0 && !folderError && (
          <div className="text-gray-500 text-sm text-center py-4">No folders found.</div>
        )}

        {folderScanned && !loadingFolders && folders.length > 0 && (
          <div className="space-y-3">
            {folders.map((f, i) => {
              const maxGB = folders[0].sizeGB || 1;
              const barPct = Math.round((f.sizeGB / maxGB) * 100);
              const sizeLabel =
                f.sizeGB >= 1
                  ? `${f.sizeGB.toFixed(1)} GB`
                  : `${f.sizeMB.toLocaleString()} MB`;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-5 text-right shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-gray-300 text-sm font-mono truncate">{f.path}</span>
                      <span className="text-yellow-400 text-sm font-semibold shrink-0">
                        {sizeLabel}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-yellow-500"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface VolumeInfo {
  drive: string;
  label: string;
  used: number;
  free: number;
  total: number;
}

interface PhysicalDisk {
  model: string;
  serial: string;
  type: string;   // SSD, HDD, Unspecified
  status: string; // Healthy, Warning, Unhealthy
  size: number;
}

interface DiskData {
  volumes: VolumeInfo[];
  disks: PhysicalDisk[];
}

export default function DiskHealth() {
  const [data, setData] = useState<DiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDiskInfo();
  }, []);

  const loadDiskInfo = async () => {
    setLoading(true);
    setError(null);

    const cmd =
      `$v=@(Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ` +
      `Select-Object @{n='drive';e={$_.Name}},@{n='label';e={$_.Description}},` +
      `@{n='used';e={[math]::Round($_.Used/1GB,2)}},` +
      `@{n='free';e={[math]::Round($_.Free/1GB,2)}},` +
      `@{n='total';e={[math]::Round(($_.Used+$_.Free)/1GB,2)}});` +
      `$d=@(try{Get-PhysicalDisk | Select-Object ` +
      `@{n='model';e={$_.FriendlyName}},` +
      `@{n='serial';e={$_.SerialNumber.Trim()}},` +
      `@{n='type';e={$_.MediaType}},` +
      `@{n='status';e={$_.HealthStatus}},` +
      `@{n='size';e={[math]::Round($_.Size/1GB,0)}}}catch{@()});` +
      `@{volumes=$v;disks=$d} | ConvertTo-Json -Depth 3 -Compress`;

    try {
      const result = await invoke<string>("run_custom_powershell", {
        command: cmd,
      });
      const parsed = JSON.parse(result.trim());
      setData({
        volumes: Array.isArray(parsed.volumes)
          ? parsed.volumes
          : parsed.volumes
            ? [parsed.volumes]
            : [],
        disks: Array.isArray(parsed.disks)
          ? parsed.disks
          : parsed.disks
            ? [parsed.disks]
            : [],
      });
    } catch (err) {
      setError(`Failed to load disk info: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const usedPct = (used: number, total: number) =>
    total > 0 ? Math.round((used / total) * 100) : 0;

  const barColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const textColor = (pct: number) => {
    if (pct >= 90) return "text-red-400 font-semibold";
    if (pct >= 75) return "text-yellow-400";
    return "text-gray-300";
  };

  const healthColor = (status: string) => {
    if (status === "Healthy") return "text-green-400";
    if (status === "Warning") return "text-yellow-400";
    return "text-red-400";
  };

  const healthIcon = (status: string) => {
    if (status === "Healthy") return "✅";
    if (status === "Warning") return "⚠️";
    return "❌";
  };

  const driveTypeIcon = (type: string) => {
    if (type === "SSD") return "⚡";
    if (type === "HDD") return "💿";
    return "💾";
  };

  // Overall health banner
  const worstStatus = data?.disks.reduce<string>((worst, d) => {
    if (d.status === "Unhealthy") return "Unhealthy";
    if (d.status === "Warning" && worst !== "Unhealthy") return "Warning";
    return worst;
  }, "Healthy") ?? "Unknown";

  if (loading) {
    return (
      <div className="text-center p-10 text-gray-400">
        ⏳ Loading disk information...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400 flex items-center justify-between">
        <span>❌ {error}</span>
        <button
          type="button"
          onClick={loadDiskInfo}
          className="underline text-sm ml-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">💾 Disk Health</h2>
        <button
          type="button"
          onClick={loadDiskInfo}
          disabled={loading}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Overall health banner */}
      {data && data.disks.length > 0 && (
        <div
          className={`rounded-lg p-4 border flex items-center gap-3 ${
            worstStatus === "Healthy"
              ? "bg-green-900/30 border-green-700"
              : worstStatus === "Warning"
                ? "bg-yellow-900/30 border-yellow-700"
                : "bg-red-900/30 border-red-700"
          }`}
        >
          <span className="text-2xl">{healthIcon(worstStatus)}</span>
          <div>
            <div
              className={`font-semibold ${healthColor(worstStatus)}`}
            >
              Overall: {worstStatus}
            </div>
            <div className="text-gray-400 text-sm">
              {data.disks.length} drive{data.disks.length !== 1 ? "s" : ""}{" "}
              detected
            </div>
          </div>
        </div>
      )}

      {/* Volume Space */}
      {data && data.volumes.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-400 mb-5">
            📊 Volume Space
          </h3>
          <div className="space-y-5">
            {data.volumes.map((vol, i) => {
              const pct = usedPct(vol.used, vol.total);
              return (
                <div key={i}>
                  <div className="flex justify-between items-baseline mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold font-mono text-lg">
                        {vol.drive}:
                      </span>
                      {vol.label && (
                        <span className="text-gray-400 text-sm">
                          {vol.label}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <span className={textColor(pct)}>{pct}% used</span>
                      <span className="text-gray-500 ml-3">
                        {vol.free} GB free of {vol.total} GB
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${barColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {pct >= 90 && (
                    <div className="text-red-400 text-xs mt-1">
                      ⚠️ Critical — less than 10% free space remaining
                    </div>
                  )}
                  {pct >= 75 && pct < 90 && (
                    <div className="text-yellow-400 text-xs mt-1">
                      Drive is getting full
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Physical Drives */}
      {data && data.disks.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-purple-400 mb-4">
            🖴 Physical Drives
          </h3>
          <div className="space-y-3">
            {data.disks.map((disk, i) => (
              <div key={i} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-lg">
                        {driveTypeIcon(disk.type)}
                      </span>
                      <span className="text-white font-semibold truncate">
                        {disk.model || "Unknown Drive"}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-600 rounded text-gray-300 shrink-0">
                        {disk.type || "Unknown"}
                      </span>
                    </div>
                    <div className="text-gray-400 text-sm font-mono">
                      S/N: {disk.serial || "N/A"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-semibold ${healthColor(disk.status)}`}
                    >
                      {healthIcon(disk.status)} {disk.status || "Unknown"}
                    </div>
                    <div className="text-gray-400 text-sm mt-1">
                      {disk.size} GB
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

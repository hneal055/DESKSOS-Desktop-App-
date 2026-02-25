import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface HotFix {
  kb: string;
  desc: string;
  date: string;
}

interface PendingUpdate {
  title: string;
  severity: string;
  size: number;
}

interface BasicData {
  service: string;
  rebootPending: boolean;
  recent: HotFix[];
}

export default function WindowsUpdate() {
  const [basic, setBasic] = useState<BasicData | null>(null);
  const [pending, setPending] = useState<PendingUpdate[] | null>(null);
  const [basicLoading, setBasicLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  useEffect(() => {
    loadBasicInfo();
  }, []);

  // Fast: service status + reboot flag + installed hotfixes
  const loadBasicInfo = async () => {
    setBasicLoading(true);
    setBasicError(null);

    const cmd =
      `$svc=(Get-Service -Name wuauserv -EA SilentlyContinue).Status;` +
      `$rb=(Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired');` +
      `$r=@(Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 15 | ` +
      `Select-Object @{n='kb';e={$_.HotFixID}},` +
      `@{n='desc';e={$_.Description}},` +
      `@{n='date';e={if($_.InstalledOn){$_.InstalledOn.ToString('yyyy-MM-dd')}else{'Unknown'}}});` +
      `@{service="$svc";rebootPending=$rb;recent=$r} | ConvertTo-Json -Depth 3 -Compress`;

    try {
      const result = await invoke<string>("run_custom_powershell", {
        command: cmd,
      });
      const parsed = JSON.parse(result.trim());
      setBasic({
        service: parsed.service ?? "Unknown",
        rebootPending: !!parsed.rebootPending,
        recent: Array.isArray(parsed.recent)
          ? parsed.recent
          : parsed.recent
            ? [parsed.recent]
            : [],
      });
    } catch (err) {
      setBasicError(`Failed to load update info: ${err}`);
    } finally {
      setBasicLoading(false);
    }
  };

  // Slow: COM object search for pending updates — user-triggered
  const checkPending = async () => {
    setPendingLoading(true);
    setPendingError(null);
    setPending(null);

    const cmd =
      `try{` +
      `$s=New-Object -ComObject Microsoft.Update.Session;` +
      `$sr=$s.CreateUpdateSearcher();` +
      `$r=$sr.Search('IsInstalled=0 and IsHidden=0 and IsAssigned=1');` +
      `$p=@($r.Updates | Select-Object ` +
      `@{n='title';e={$_.Title}},` +
      `@{n='severity';e={if($_.MsrcSeverity){$_.MsrcSeverity}else{'Optional'}}},` +
      `@{n='size';e={[math]::Round($_.MaxDownloadSize/1MB,1)}});` +
      `ConvertTo-Json -InputObject $p -Compress` +
      `}catch{"[]"}`;

    try {
      const result = await invoke<string>("run_custom_powershell", {
        command: cmd,
      });
      const trimmed = result.trim();
      const parsed = JSON.parse(!trimmed || trimmed === "null" ? "[]" : trimmed);
      setPending(Array.isArray(parsed) ? parsed : [parsed]);
    } catch (err) {
      setPendingError(`Pending update check failed: ${err}`);
    } finally {
      setPendingLoading(false);
    }
  };

  const severityColor = (s: string) => {
    if (s === "Critical") return "bg-red-700 text-red-200";
    if (s === "Important") return "bg-orange-700 text-orange-200";
    if (s === "Moderate") return "bg-yellow-700 text-yellow-200";
    return "bg-gray-600 text-gray-300";
  };

  const severityOrder = (s: string) => {
    if (s === "Critical") return 0;
    if (s === "Important") return 1;
    if (s === "Moderate") return 2;
    return 3;
  };

  const sortedPending = pending
    ? [...pending].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    : null;

  const criticalCount = pending?.filter((u) => u.severity === "Critical").length ?? 0;
  const importantCount = pending?.filter((u) => u.severity === "Important").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🔄 Windows Update</h2>
        <button
          type="button"
          onClick={loadBasicInfo}
          disabled={basicLoading}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {basicLoading && (
        <div className="text-center p-8 text-gray-400">
          ⏳ Loading update information...
        </div>
      )}

      {basicError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400">
          ❌ {basicError}
        </div>
      )}

      {basic && (
        <>
          {/* Status bar */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`rounded-lg p-4 border flex items-center gap-3 ${
                basic.service === "Running"
                  ? "bg-green-900/30 border-green-700"
                  : "bg-red-900/30 border-red-700"
              }`}
            >
              <span className="text-2xl">
                {basic.service === "Running" ? "✅" : "❌"}
              </span>
              <div>
                <div className="text-gray-400 text-xs mb-0.5">
                  Windows Update Service
                </div>
                <div
                  className={`font-semibold ${basic.service === "Running" ? "text-green-400" : "text-red-400"}`}
                >
                  {basic.service}
                </div>
              </div>
            </div>

            <div
              className={`rounded-lg p-4 border flex items-center gap-3 ${
                basic.rebootPending
                  ? "bg-yellow-900/30 border-yellow-700"
                  : "bg-gray-800 border-gray-600"
              }`}
            >
              <span className="text-2xl">
                {basic.rebootPending ? "⚠️" : "✅"}
              </span>
              <div>
                <div className="text-gray-400 text-xs mb-0.5">
                  Reboot Status
                </div>
                <div
                  className={`font-semibold ${basic.rebootPending ? "text-yellow-400" : "text-green-400"}`}
                >
                  {basic.rebootPending ? "Reboot Required" : "No Reboot Needed"}
                </div>
              </div>
            </div>
          </div>

          {/* Pending updates check */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-orange-400">
                📥 Pending Updates
              </h3>
              {pending !== null && (
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    criticalCount > 0
                      ? "bg-red-700 text-red-200"
                      : importantCount > 0
                        ? "bg-orange-700 text-orange-200"
                        : "bg-green-800 text-green-300"
                  }`}
                >
                  {pending.length === 0
                    ? "Up to date"
                    : `${pending.length} pending`}
                </span>
              )}
            </div>

            {pending === null && !pendingLoading && (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm mb-4">
                  Checking for pending updates queries the Windows Update service
                  and may take up to 30 seconds.
                </p>
                <button
                  type="button"
                  onClick={checkPending}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition"
                >
                  🔍 Check for Pending Updates
                </button>
              </div>
            )}

            {pendingLoading && (
              <div className="text-center py-6 text-gray-400">
                <div className="text-2xl mb-2">⏳</div>
                <div>Querying Windows Update service...</div>
                <div className="text-sm text-gray-500 mt-1">
                  This may take up to 30 seconds
                </div>
              </div>
            )}

            {pendingError && (
              <div className="text-red-400 text-sm">❌ {pendingError}</div>
            )}

            {sortedPending !== null && !pendingLoading && (
              <>
                {sortedPending.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2">✅</div>
                    <div className="text-green-400 font-semibold">
                      System is up to date
                    </div>
                    <div className="text-gray-400 text-sm mt-1">
                      No pending updates found
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedPending.map((u, i) => (
                      <div
                        key={i}
                        className="bg-gray-700 rounded-lg p-3 flex items-start justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm">{u.title}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {u.size > 0 && (
                            <span className="text-gray-400 text-xs">
                              {u.size} MB
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${severityColor(u.severity)}`}
                          >
                            {u.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={checkPending}
                  className="mt-4 text-sm text-gray-500 hover:text-gray-300 underline"
                >
                  Re-check
                </button>
              </>
            )}
          </div>

          {/* Recently installed */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-4">
              📋 Recently Installed
            </h3>
            {basic.recent.length === 0 ? (
              <div className="text-gray-400 text-sm">
                No update history found
              </div>
            ) : (
              <div className="space-y-2">
                {basic.recent.map((fix, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-blue-400 font-mono text-sm font-bold">
                        {fix.kb}
                      </span>
                      <span className="text-gray-300 text-sm">
                        {fix.desc || "Update"}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs font-mono shrink-0 ml-3">
                      {fix.date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

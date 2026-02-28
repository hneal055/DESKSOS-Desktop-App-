import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ErrorEvent {
  time: string;
  id: number;
  level: string;
  log: string;
  source: string;
  message: string;
}

interface ErrorData {
  sysErrors: ErrorEvent[];
  appErrors: ErrorEvent[];
  critical: ErrorEvent[];
  hardware: ErrorEvent[];
}

type Tab = "system" | "application" | "critical" | "hardware";

// $fmt scriptblock: normalises each WinEvent into a plain object
// Hardware tab: Level 1+2 System events in last 30 days filtered by storage/disk providers
// and known hardware-failure event IDs
const ERRORS_CMD =
  `$fmt={` +
  `$m=if($_.Message){($_.Message -replace '[\\r\\n]+',' ').Trim()}else{''};` +
  `if($m.Length -gt 450){$m=$m.Substring(0,450)+'...'};` +
  `[PSCustomObject]@{` +
  `time=$_.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss');` +
  `id=$_.Id;level=$_.LevelDisplayName;log=$_.LogName;source=$_.ProviderName;message=$m}};` +

  `$sysE=@(Get-WinEvent -FilterHashtable @{LogName='System';Level=2} ` +
  `-MaxEvents 10 -EA SilentlyContinue | ForEach-Object $fmt);` +

  `$appE=@(Get-WinEvent -FilterHashtable @{LogName='Application';Level=2} ` +
  `-MaxEvents 10 -EA SilentlyContinue | ForEach-Object $fmt);` +

  `$crit=@(Get-WinEvent -FilterHashtable @{LogName='System','Application';Level=1;` +
  `StartTime=(Get-Date).AddHours(-24)} -MaxEvents 50 -EA SilentlyContinue | ` +
  `Sort-Object TimeCreated -Descending | ForEach-Object $fmt);` +

  `$hw=@(Get-WinEvent -FilterHashtable @{LogName='System';Level=1,2;` +
  `StartTime=(Get-Date).AddDays(-30)} -MaxEvents 200 -EA SilentlyContinue | ` +
  `Where-Object {` +
  `$_.ProviderName -match '(?i)disk|ntfs|storport|storahci|nvme|atapi|whea|kernel.pnp' ` +
  `-or $_.Id -in @(11,15,51,153,55,41,6008,7034)} | ` +
  `Sort-Object TimeCreated -Descending | Select-Object -First 10 | ForEach-Object $fmt);` +

  `@{sysErrors=$sysE;appErrors=$appE;critical=$crit;hardware=$hw} | ConvertTo-Json -Depth 3 -Compress`;

const toArray = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? v : v ? [v as T] : [];

export default function RecentErrors() {
  const [data, setData] = useState<ErrorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("system");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    setExpanded(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: ERRORS_CMD });
      const parsed = JSON.parse(raw.trim());
      setData({
        sysErrors: toArray<ErrorEvent>(parsed.sysErrors),
        appErrors: toArray<ErrorEvent>(parsed.appErrors),
        critical: toArray<ErrorEvent>(parsed.critical),
        hardware: toArray<ErrorEvent>(parsed.hardware),
      });
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  const levelIcon = (level: string) => {
    if (level === "Critical") return "🔴";
    if (level === "Error") return "🟠";
    return "🟡";
  };

  const levelBadge = (level: string) => {
    if (level === "Critical") return "bg-red-800 text-red-200";
    if (level === "Error") return "bg-orange-800 text-orange-200";
    return "bg-yellow-800 text-yellow-200";
  };

  const EventList = ({
    events,
    emptyMsg,
    warning,
  }: {
    events: ErrorEvent[];
    emptyMsg: string;
    warning?: string;
  }) => {
    if (events.length === 0) {
      return (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-gray-400">{emptyMsg}</div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {warning && (
          <div className="mb-3 bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            ⚠️ {warning}
          </div>
        )}
        {events.map((e, i) => {
          const isOpen = expanded === i;
          return (
            <div
              key={i}
              onClick={() => setExpanded(isOpen ? null : i)}
              className="border border-gray-700 hover:border-gray-500 rounded-lg cursor-pointer transition-colors bg-gray-900/40"
            >
              <div className="p-3 flex items-start gap-3">
                <span className="text-base mt-0.5 shrink-0">{levelIcon(e.level)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-gray-400 text-xs font-mono shrink-0">{e.time}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200 max-w-[200px] truncate">
                      {e.source}
                    </span>
                    <span className="text-gray-600 text-xs">ID {e.id}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-semibold ml-auto shrink-0 ${levelBadge(e.level)}`}
                    >
                      {e.level}
                    </span>
                  </div>
                  {!isOpen ? (
                    <div className="text-gray-300 text-sm truncate">{e.message || "(no message)"}</div>
                  ) : (
                    <div className="mt-2 bg-gray-950 rounded p-3 text-gray-300 text-sm break-words whitespace-pre-wrap">
                      {e.message || "(no message)"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const tabs: { id: Tab; label: string; count: number; color: string }[] = [
    { id: "system", label: "System Errors", count: data?.sysErrors.length ?? 0, color: "text-orange-400" },
    { id: "application", label: "App Errors", count: data?.appErrors.length ?? 0, color: "text-purple-400" },
    { id: "critical", label: "Critical 24h", count: data?.critical.length ?? 0, color: "text-red-400" },
    { id: "hardware", label: "Hardware", count: data?.hardware.length ?? 0, color: "text-yellow-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🚨 Recent System Errors</h2>
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

      {/* Summary stat cards — also act as tab switchers */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setActiveTab(t.id); setExpanded(null); }}
              className={`bg-gray-800 rounded-lg p-4 text-left transition hover:bg-gray-700 border ${
                activeTab === t.id ? "border-blue-500" : "border-transparent"
              }`}
            >
              <div className={`text-2xl font-bold ${t.color}`}>{t.count}</div>
              <div className="text-gray-400 text-xs mt-1">{t.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tab bar */}
      {data && (
        <div className="flex gap-1 border-b border-gray-700">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setActiveTab(t.id); setExpanded(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                activeTab === t.id
                  ? "bg-gray-800 text-white border-b-2 border-blue-500 -mb-px"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-2 text-xs ${t.color}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading state before first load */}
      {loading && !data && (
        <div className="text-center py-16 text-gray-400">⏳ Reading event logs...</div>
      )}

      {/* Tab content */}
      {data && (
        <div className="bg-gray-800 rounded-lg p-6">
          {activeTab === "system" && (
            <EventList events={data.sysErrors} emptyMsg="No recent system errors found" />
          )}
          {activeTab === "application" && (
            <EventList events={data.appErrors} emptyMsg="No recent application errors found" />
          )}
          {activeTab === "critical" && (
            <EventList
              events={data.critical}
              emptyMsg="No critical events in the last 24 hours"
            />
          )}
          {activeTab === "hardware" && (
            <EventList
              events={data.hardware}
              emptyMsg="No hardware-related events found in the last 30 days"
              warning={
                data.hardware.length > 0
                  ? "Hardware-related events detected in the last 30 days. Check disk, driver, and storage health."
                  : undefined
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

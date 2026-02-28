import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ServiceEntry {
  name: string;
  display: string;
  status: string;
  startType: string;
  account: string;
  path: string;
}

type Tab = "running" | "all" | "critical" | "nonms";

const SERVICES_CMD =
  `$svcs=@(Get-CimInstance Win32_Service | ` +
  `Select-Object @{n='name';e={$_.Name}},` +
  `@{n='display';e={$_.DisplayName}},` +
  `@{n='status';e={$_.State}},` +
  `@{n='startType';e={$_.StartMode}},` +
  `@{n='account';e={if($_.StartName){$_.StartName}else{''}}},` +
  `@{n='path';e={if($_.PathName){$_.PathName.Substring(0,[math]::Min(100,$_.PathName.Length))}else{''}}});` +
  `$svcs | ConvertTo-Json -Compress`;

// Known critical services every Windows system should have running
const CRITICAL = [
  { name: "EventLog",          label: "Windows Event Log" },
  { name: "RpcSs",             label: "Remote Procedure Call" },
  { name: "Schedule",          label: "Task Scheduler" },
  { name: "Dhcp",              label: "DHCP Client" },
  { name: "Dnscache",          label: "DNS Client" },
  { name: "LanmanWorkstation", label: "Workstation" },
  { name: "LanmanServer",      label: "Server" },
  { name: "AudioSrv",          label: "Windows Audio" },
  { name: "WinDefend",         label: "Windows Defender" },
  { name: "wuauserv",          label: "Windows Update" },
  { name: "Spooler",           label: "Print Spooler" },
  { name: "W32Time",           label: "Windows Time" },
  { name: "CryptSvc",          label: "Cryptographic Services" },
  { name: "BFE",               label: "Base Filtering Engine" },
  { name: "mpssvc",            label: "Windows Firewall" },
];

const isSystemPath = (path: string): boolean => {
  if (!path) return true;
  const p = path.toLowerCase().replace(/"/g, "");
  return (
    p.includes("\\windows\\") ||
    p.startsWith("c:\\windows") ||
    p.startsWith("%systemroot%") ||
    p.startsWith("%windir%")
  );
};

const startTypeColor = (t: string) => {
  if (t === "Auto") return "text-green-400";
  if (t === "Manual") return "text-yellow-400";
  if (t === "Disabled") return "text-red-400";
  return "text-gray-400";
};

const statusBadge = (s: string) => {
  if (s === "Running") return "bg-green-900/60 text-green-300 border border-green-700";
  if (s === "Stopped") return "bg-gray-700 text-gray-400 border border-gray-600";
  if (s === "Paused") return "bg-yellow-900/60 text-yellow-300 border border-yellow-700";
  return "bg-gray-700 text-gray-500 border border-gray-600";
};

export default function RunningServices() {
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("running");
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: SERVICES_CMD });
      const parsed = JSON.parse(raw.trim());
      setServices(Array.isArray(parsed) ? parsed : parsed ? [parsed] : []);
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  const running = useMemo(
    () => services.filter((s) => s.status === "Running"),
    [services]
  );

  const nonMs = useMemo(
    () => services.filter((s) => s.status === "Running" && !isSystemPath(s.path)),
    [services]
  );

  const criticalMap = useMemo(() => {
    const map: Record<string, ServiceEntry | undefined> = {};
    for (const svc of services) map[svc.name.toLowerCase()] = svc;
    return map;
  }, [services]);

  const filteredAll = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.display.toLowerCase().includes(q)
    );
  }, [services, search]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "running", label: "Running", count: running.length },
    { id: "all", label: "All Services", count: services.length },
    { id: "critical", label: "Critical", count: CRITICAL.length },
    { id: "nonms", label: "Non-Microsoft", count: nonMs.length },
  ];

  const ServiceRow = ({ svc }: { svc: ServiceEntry }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-700 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-200 text-sm font-medium">{svc.display}</span>
          <span className="text-gray-600 text-xs font-mono">({svc.name})</span>
        </div>
        {svc.account && (
          <div className="text-gray-600 text-xs truncate">{svc.account}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-semibold ${startTypeColor(svc.startType)}`}>
          {svc.startType}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${statusBadge(svc.status)}`}>
          {svc.status}
        </span>
      </div>
    </div>
  );

  // Derived stats
  const autoRunning = running.filter((s) => s.startType === "Auto").length;
  const manualRunning = running.filter((s) => s.startType === "Manual").length;
  const criticalIssues = CRITICAL.filter((c) => {
    const svc = criticalMap[c.name.toLowerCase()];
    return !svc || svc.status !== "Running";
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🧰 Running Services</h2>
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

      {/* Summary cards */}
      {services.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{running.length}</div>
            <div className="text-gray-400 text-xs mt-1">Running</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{services.length}</div>
            <div className="text-gray-400 text-xs mt-1">Total Services</div>
          </div>
          <div
            className={`bg-gray-800 rounded-lg p-4 border ${
              criticalIssues > 0 ? "border-red-700" : "border-transparent"
            }`}
          >
            <div
              className={`text-2xl font-bold ${
                criticalIssues > 0 ? "text-red-400" : "text-green-400"
              }`}
            >
              {criticalIssues === 0 ? "✓" : criticalIssues}
            </div>
            <div className="text-gray-400 text-xs mt-1">
              {criticalIssues === 0 ? "Critical OK" : "Critical Issues"}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{nonMs.length}</div>
            <div className="text-gray-400 text-xs mt-1">Non-Microsoft</div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition ${
              activeTab === t.id
                ? "bg-gray-800 text-white border-b-2 border-blue-500 -mb-px"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            {t.label}
            {services.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-500">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {loading && services.length === 0 && (
        <div className="text-center py-16 text-gray-400">⏳ Loading services...</div>
      )}

      {services.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          {/* Running tab */}
          {activeTab === "running" && (
            <>
              <div className="text-gray-500 text-xs mb-4">
                {autoRunning} automatic · {manualRunning} manual/triggered
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {running.map((s, i) => <ServiceRow key={i} svc={s} />)}
              </div>
            </>
          )}

          {/* All tab */}
          {activeTab === "all" && (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or display name..."
                className="w-full bg-gray-700 text-gray-200 placeholder-gray-500 px-4 py-2 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-gray-500 text-xs mb-3">
                {search
                  ? `${filteredAll.length} of ${services.length} matching`
                  : `${services.length} total services`}
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {filteredAll.map((s, i) => <ServiceRow key={i} svc={s} />)}
              </div>
            </>
          )}

          {/* Critical tab */}
          {activeTab === "critical" && (
            <div className="space-y-2">
              {CRITICAL.map((c) => {
                const svc = criticalMap[c.name.toLowerCase()];
                const isRunning = svc?.status === "Running";
                const notFound = !svc;
                return (
                  <div
                    key={c.name}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isRunning
                        ? "border-gray-700 bg-gray-900/30"
                        : "border-red-800 bg-red-900/20"
                    }`}
                  >
                    <span className="text-lg shrink-0">
                      {isRunning ? "✅" : notFound ? "❔" : "❌"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-200 text-sm font-medium">{c.label}</div>
                      <div className="text-gray-600 text-xs font-mono">{c.name}</div>
                    </div>
                    <div className="shrink-0">
                      {notFound ? (
                        <span className="text-xs text-gray-600">Not installed</span>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${statusBadge(svc!.status)}`}
                        >
                          {svc!.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Non-Microsoft tab */}
          {activeTab === "nonms" && (
            <>
              <div className="text-gray-500 text-xs mb-4">
                Running services from non-Windows system directories — review for unfamiliar entries.
              </div>
              {nonMs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No non-system running services found.
                </div>
              ) : (
                <div className="max-h-[480px] overflow-y-auto">
                  {nonMs.map((s, i) => (
                    <div key={i} className="py-2.5 border-b border-gray-700 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-200 text-sm font-medium">{s.display}</span>
                        <span className="text-gray-600 text-xs font-mono">({s.name})</span>
                        <span
                          className={`ml-auto text-xs px-2 py-0.5 rounded font-semibold ${statusBadge(s.status)}`}
                        >
                          {s.status}
                        </span>
                      </div>
                      {s.path && (
                        <div className="text-gray-600 text-xs font-mono truncate">{s.path}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

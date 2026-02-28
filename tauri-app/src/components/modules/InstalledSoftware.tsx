import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppEntry {
  name: string;
  publisher: string;
  version: string;
  installDate: string;
}

type Tab = "all" | "microsoft" | "recent" | "publishers";

// Query all three registry hives then deduplicate by name
const SOFTWARE_CMD =
  `$paths=@(` +
  `'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',` +
  `'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',` +
  `'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');` +
  `$sw=@(Get-ItemProperty -Path $paths -EA SilentlyContinue | ` +
  `Where-Object {$_.DisplayName} | ` +
  `Select-Object @{n='name';e={$_.DisplayName}},` +
  `@{n='publisher';e={if($_.Publisher){$_.Publisher}else{'Unknown'}}},` +
  `@{n='version';e={if($_.DisplayVersion){$_.DisplayVersion}else{''}}},` +
  `@{n='installDate';e={if($_.InstallDate){$_.InstallDate}else{''}}} | ` +
  `Sort-Object name -Unique);` +
  `$sw | ConvertTo-Json -Compress`;

const parseDate = (d: string | undefined | null): Date | null => {
  if (!d) return null;
  const s = d.trim();
  if (/^\d{8}$/.test(s)) {
    const dt = new Date(
      parseInt(s.substring(0, 4)),
      parseInt(s.substring(4, 6)) - 1,
      parseInt(s.substring(6, 8))
    );
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
};

const formatDate = (d: string): string => {
  const dt = parseDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export default function InstalledSoftware() {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [recentDays, setRecentDays] = useState<30 | 90>(30);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: SOFTWARE_CMD });
      const parsed = JSON.parse(raw.trim());
      setApps(Array.isArray(parsed) ? parsed : parsed ? [parsed] : []);
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  const msApps = useMemo(
    () => apps.filter((a) => /microsoft/i.test(a.publisher)),
    [apps]
  );

  const recentApps = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - recentDays);
    return apps
      .map((a) => ({ ...a, _date: parseDate(a.installDate) }))
      .filter((a): a is AppEntry & { _date: Date } => a._date !== null && a._date >= cutoff)
      .sort((a, b) => b._date.getTime() - a._date.getTime());
  }, [apps, recentDays]);

  const publisherStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of apps) {
      const pub = a.publisher || "Unknown";
      counts[pub] = (counts[pub] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [apps]);

  const filteredApps = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.publisher.toLowerCase().includes(q)
    );
  }, [apps, search]);

  const uniquePublishers = useMemo(
    () => new Set(apps.map((a) => a.publisher)).size,
    [apps]
  );

  const AppRow = ({ a }: { a: AppEntry }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-700 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-gray-200 text-sm font-medium truncate">{a.name}</div>
        <div className="text-gray-500 text-xs truncate">{a.publisher}</div>
      </div>
      <div className="text-right shrink-0">
        {a.version && (
          <div className="text-gray-400 text-xs font-mono">{a.version}</div>
        )}
        <div className="text-gray-600 text-xs">{formatDate(a.installDate)}</div>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All Software", count: apps.length },
    { id: "microsoft", label: "Microsoft", count: msApps.length },
    { id: "recent", label: "Recently Installed", count: recentApps.length },
    { id: "publishers", label: "By Publisher", count: uniquePublishers },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">📦 Installed Software</h2>
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

      {/* Summary stat cards */}
      {apps.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{apps.length}</div>
            <div className="text-gray-400 text-xs mt-1">Total Installed</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-cyan-400">{msApps.length}</div>
            <div className="text-gray-400 text-xs mt-1">Microsoft Products</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{recentApps.length}</div>
            <div className="text-gray-400 text-xs mt-1">Installed (30d)</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{uniquePublishers}</div>
            <div className="text-gray-400 text-xs mt-1">Publishers</div>
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
            {apps.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-500">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading / empty state */}
      {loading && apps.length === 0 && (
        <div className="text-center py-16 text-gray-400">⏳ Scanning installed software...</div>
      )}
      {!loading && apps.length === 0 && !error && (
        <div className="text-center py-16 text-gray-500">No software registry data found.</div>
      )}

      {/* Tab content */}
      {apps.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">

          {/* All Software */}
          {activeTab === "all" && (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or publisher..."
                className="w-full bg-gray-700 text-gray-200 placeholder-gray-500 px-4 py-2 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-gray-500 text-xs mb-3">
                {search
                  ? `${filteredApps.length} of ${apps.length} matching`
                  : `${apps.length} applications`}
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {filteredApps.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-8">No matches found.</div>
                ) : (
                  filteredApps.map((a, i) => <AppRow key={i} a={a} />)
                )}
              </div>
            </>
          )}

          {/* Microsoft Products */}
          {activeTab === "microsoft" && (
            <>
              <div className="text-gray-500 text-xs mb-4">
                {msApps.length} Microsoft products detected
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {msApps.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-8">
                    No Microsoft products found.
                  </div>
                ) : (
                  msApps.map((a, i) => <AppRow key={i} a={a} />)
                )}
              </div>
            </>
          )}

          {/* Recently Installed */}
          {activeTab === "recent" && (
            <>
              <div className="flex gap-2 mb-4">
                {([30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRecentDays(d)}
                    className={`px-3 py-1.5 rounded text-sm transition ${
                      recentDays === d
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Last {d} days
                  </button>
                ))}
              </div>
              {recentApps.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-sm">
                    No apps with install dates found in the last {recentDays} days.
                  </div>
                  <div className="text-gray-600 text-xs mt-2">
                    Many installers do not record an install date in the registry.
                  </div>
                </div>
              ) : (
                <div className="max-h-[520px] overflow-y-auto">
                  {recentApps.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2.5 border-b border-gray-700 last:border-0"
                    >
                      <div className="text-green-400 text-xs font-mono shrink-0 w-28">
                        {a._date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-200 text-sm font-medium truncate">{a.name}</div>
                        <div className="text-gray-500 text-xs truncate">{a.publisher}</div>
                      </div>
                      {a.version && (
                        <div className="text-gray-400 text-xs font-mono shrink-0">{a.version}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* By Publisher */}
          {activeTab === "publishers" && (
            <>
              <div className="text-gray-500 text-xs mb-5">
                Top {publisherStats.length} publishers across {apps.length} applications
              </div>
              <div className="space-y-3">
                {publisherStats.map(([pub, count], i) => {
                  const maxCount = publisherStats[0][1];
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-6 text-right shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-gray-300 text-sm truncate">{pub}</span>
                          <span className="text-blue-400 text-sm font-semibold shrink-0">
                            {count} {count === 1 ? "app" : "apps"}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

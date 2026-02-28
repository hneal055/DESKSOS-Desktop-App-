import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Adapter {
  name: string;
  desc: string;
  status: string;
  mac: string;
  speed: string;
}

interface AdapterIP {
  iface: string;
  addr: string;
  prefix: number;
  family: string;
}

interface AdapterStats {
  name: string;
  recvGB: number;
  sentGB: number;
}

interface Gateway {
  iface: string;
  gateway: string;
  dns: string;
}

interface AdapterData {
  adapters: Adapter[];
  ips: AdapterIP[];
  stats: AdapterStats[];
  gateways: Gateway[];
}

const ADAPTERS_CMD =
  `$a=@(Get-NetAdapter | Select-Object ` +
  `@{n='name';e={$_.Name}},@{n='desc';e={$_.InterfaceDescription}},` +
  `@{n='status';e={[string]$_.Status}},@{n='mac';e={$_.MacAddress}},` +
  `@{n='speed';e={$_.LinkSpeed}});` +

  `$i=@(Get-NetIPAddress | Where-Object {` +
  `$_.InterfaceAlias -notmatch '(?i)loopback|teredo|isatap' -and ` +
  `$_.IPAddress -notmatch '^127\\.|^::1$'} | ` +
  `Select-Object @{n='iface';e={$_.InterfaceAlias}},` +
  `@{n='addr';e={$_.IPAddress}},@{n='prefix';e={[int]$_.PrefixLength}},` +
  `@{n='family';e={if($_.AddressFamily -eq 2){'IPv4'}else{'IPv6'}}});` +

  `$s=@(try{Get-NetAdapterStatistics | Select-Object ` +
  `@{n='name';e={$_.Name}},` +
  `@{n='recvGB';e={[math]::Round($_.ReceivedBytes/1GB,3)}},` +
  `@{n='sentGB';e={[math]::Round($_.SentBytes/1GB,3)}}}catch{@()});` +

  `$g=@(try{Get-NetIPConfiguration | Select-Object ` +
  `@{n='iface';e={$_.InterfaceAlias}},` +
  `@{n='gateway';e={if($_.IPv4DefaultGateway){$_.IPv4DefaultGateway.NextHop}else{''}}},` +
  `@{n='dns';e={($_.DNSServer | Where-Object {$_.AddressFamily -eq 2} | ` +
  `Select-Object -ExpandProperty ServerAddresses) -join ', '}}}catch{@()});` +

  `@{adapters=$a;ips=$i;stats=$s;gateways=$g} | ConvertTo-Json -Depth 4 -Compress`;

const toArr = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? v : v ? [v as T] : [];

const isApipa = (addr: string) => addr.startsWith("169.254.");
const isLinkLocal = (addr: string) => /^fe80/i.test(addr);

export default function NetworkAdapters() {
  const [data, setData] = useState<AdapterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: ADAPTERS_CMD });
      const p = JSON.parse(raw.trim());
      setData({
        adapters: toArr<Adapter>(p.adapters),
        ips: toArr<AdapterIP>(p.ips),
        stats: toArr<AdapterStats>(p.stats),
        gateways: toArr<Gateway>(p.gateways),
      });
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  const enriched = useMemo(() => {
    if (!data) return [];
    return data.adapters.map((a) => ({
      ...a,
      ips: data.ips.filter((ip) => ip.iface === a.name),
      stats: data.stats.find((s) => s.name === a.name) ?? null,
      gw: data.gateways.find((g) => g.iface === a.name) ?? null,
    }));
  }, [data]);

  const visible = showAll ? enriched : enriched.filter((a) => a.status === "Up");
  const upCount = enriched.filter((a) => a.status === "Up").length;

  const statusColor = (s: string) => {
    if (s === "Up") return "text-green-400";
    if (s === "Down") return "text-red-400";
    return "text-gray-500";
  };

  const statusDot = (s: string) => {
    if (s === "Up") return "bg-green-400";
    if (s === "Down") return "bg-red-400";
    return "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🔌 Network Adapters</h2>
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
        <div className="text-center py-16 text-gray-400">⏳ Reading adapter information...</div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="flex items-center gap-4">
            <div className="bg-gray-800 rounded-lg px-4 py-3">
              <span className="text-green-400 font-bold text-xl">{upCount}</span>
              <span className="text-gray-400 text-sm ml-2">connected</span>
            </div>
            <div className="bg-gray-800 rounded-lg px-4 py-3">
              <span className="text-gray-300 font-bold text-xl">{enriched.length}</span>
              <span className="text-gray-400 text-sm ml-2">total adapters</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className={`px-4 py-3 rounded-lg text-sm transition ${
                showAll
                  ? "bg-blue-700 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {showAll ? "Show Connected Only" : "Show All Adapters"}
            </button>
          </div>

          {/* Adapter cards */}
          <div className="space-y-3">
            {visible.length === 0 && (
              <div className="text-center py-8 text-gray-500">No connected adapters found.</div>
            )}
            {visible.map((a) => {
              const isOpen = expanded === a.name;
              const ipv4 = a.ips.filter((ip) => ip.family === "IPv4");
              const ipv6 = a.ips.filter((ip) => ip.family === "IPv6");
              return (
                <div
                  key={a.name}
                  className={`bg-gray-800 rounded-lg border transition-colors ${
                    isOpen ? "border-blue-600" : "border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {/* Card header — always visible */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : a.name)}
                    className="w-full p-4 flex items-center gap-4 text-left"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(a.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold">{a.name}</span>
                        <span className={`text-xs font-semibold ${statusColor(a.status)}`}>
                          {a.status}
                        </span>
                        {a.speed && a.status === "Up" && (
                          <span className="text-xs text-gray-500">{a.speed}</span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs truncate">{a.desc}</div>
                    </div>
                    {/* IPv4 address preview */}
                    {ipv4.length > 0 && !isOpen && (
                      <div className="text-gray-400 text-sm font-mono shrink-0">
                        {ipv4[0].addr}/{ipv4[0].prefix}
                      </div>
                    )}
                    <span className="text-gray-600 text-xs shrink-0">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-700 pt-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* IP Addresses */}
                        <div>
                          <div className="text-xs font-semibold text-blue-400 mb-2">IP Addresses</div>
                          {a.ips.length === 0 ? (
                            <div className="text-gray-600 text-sm">None assigned</div>
                          ) : (
                            <div className="space-y-1">
                              {ipv4.map((ip, j) => (
                                <div key={j} className="flex items-center gap-2">
                                  <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
                                    IPv4
                                  </span>
                                  <span
                                    className={`text-sm font-mono ${
                                      isApipa(ip.addr) ? "text-yellow-400" : "text-gray-300"
                                    }`}
                                  >
                                    {ip.addr}/{ip.prefix}
                                  </span>
                                  {isApipa(ip.addr) && (
                                    <span className="text-xs text-yellow-500">APIPA</span>
                                  )}
                                </div>
                              ))}
                              {ipv6.slice(0, 2).map((ip, j) => (
                                <div key={j} className="flex items-center gap-2">
                                  <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">
                                    IPv6
                                  </span>
                                  <span
                                    className={`text-xs font-mono ${
                                      isLinkLocal(ip.addr) ? "text-gray-500" : "text-gray-300"
                                    }`}
                                  >
                                    {ip.addr}/{ip.prefix}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Gateway & DNS */}
                        <div>
                          <div className="text-xs font-semibold text-green-400 mb-2">
                            Gateway &amp; DNS
                          </div>
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="text-gray-500 text-xs">Gateway: </span>
                              <span className="text-gray-300 font-mono">
                                {a.gw?.gateway || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">DNS: </span>
                              <span className="text-gray-300 font-mono text-xs">
                                {a.gw?.dns || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* MAC + Stats row */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                        <div className="bg-gray-700 rounded p-3">
                          <div className="text-gray-500 text-xs mb-1">MAC Address</div>
                          <div className="text-gray-300 font-mono text-xs">{a.mac || "—"}</div>
                        </div>
                        {a.stats && (
                          <>
                            <div className="bg-gray-700 rounded p-3">
                              <div className="text-gray-500 text-xs mb-1">Received</div>
                              <div className="text-blue-400 font-semibold">
                                {a.stats.recvGB.toFixed(3)} GB
                              </div>
                            </div>
                            <div className="bg-gray-700 rounded p-3">
                              <div className="text-gray-500 text-xs mb-1">Sent</div>
                              <div className="text-purple-400 font-semibold">
                                {a.stats.sentGB.toFixed(3)} GB
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Advanced props row */}
                      <div className="text-xs text-gray-600">
                        Speed: {a.speed || "N/A"} &middot; Status: {a.status}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

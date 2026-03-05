import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Tool = "ping" | "traceroute" | "dns" | "portscan";

interface DnsRecord {
  Name: string;
  Type: string;
  TTL: number;
  data: string;
}

interface PortResult {
  port: number;
  open: boolean;
}

const PORT_SERVICES: Record<number, string> = {
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  80: "HTTP",
  110: "POP3",
  135: "RPC",
  139: "NetBIOS",
  143: "IMAP",
  443: "HTTPS",
  445: "SMB",
  1433: "MSSQL",
  3306: "MySQL",
  3389: "RDP",
  5432: "PostgreSQL",
  8080: "HTTP-Alt",
  8443: "HTTPS-Alt",
};

const COMMON_PORTS = [22, 53, 80, 110, 135, 139, 143, 443, 445, 1433, 3306, 3389, 5432, 8080, 8443];
const DNS_TYPES = ["A", "AAAA", "MX", "NS", "CNAME", "PTR", "TXT", "SOA"];

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9.\-_]/g, "");

const toArr = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? v : v ? [v as T] : [];

export default function NetworkTools() {
  const [activeTool, setActiveTool] = useState<Tool>("ping");

  // ── Ping ──────────────────────────────────────────────────────────────
  const [pingHost, setPingHost] = useState("8.8.8.8");
  const [pingCount, setPingCount] = useState("4");
  const [pingOutput, setPingOutput] = useState<string | null>(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);

  // ── Traceroute ────────────────────────────────────────────────────────
  const [traceHost, setTraceHost] = useState("8.8.8.8");
  const [traceMaxHops, setTraceMaxHops] = useState("30");
  const [traceOutput, setTraceOutput] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  // ── DNS ───────────────────────────────────────────────────────────────
  const [dnsHost, setDnsHost] = useState("google.com");
  const [dnsType, setDnsType] = useState("A");
  const [dnsServer, setDnsServer] = useState("");
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);

  // ── Port Scan ─────────────────────────────────────────────────────────
  const [scanHost, setScanHost] = useState("localhost");
  const [selectedPorts, setSelectedPorts] = useState<Set<number>>(
    new Set([22, 80, 443, 445, 3389])
  );
  const [customPorts, setCustomPorts] = useState("");
  const [scanResults, setScanResults] = useState<PortResult[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // ── Actions ───────────────────────────────────────────────────────────

  const runPing = async () => {
    const host = sanitize(pingHost) || "8.8.8.8";
    const count = Math.min(Math.max(parseInt(pingCount) || 4, 1), 20);
    setPingLoading(true);
    setPingOutput(null);
    setPingError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", {
        command: `ping -n ${count} ${host}`,
      });
      setPingOutput(raw.trim());
    } catch (err) {
      setPingError(`${err}`);
    } finally {
      setPingLoading(false);
    }
  };

  const runTraceroute = async () => {
    const host = sanitize(traceHost) || "8.8.8.8";
    const maxHops = Math.min(Math.max(parseInt(traceMaxHops) || 30, 1), 64);
    setTraceLoading(true);
    setTraceOutput(null);
    setTraceError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", {
        command: `tracert -h ${maxHops} -w 1000 ${host}`,
      });
      setTraceOutput(raw.trim());
    } catch (err) {
      setTraceError(`${err}`);
    } finally {
      setTraceLoading(false);
    }
  };

  const runDns = async () => {
    const host = sanitize(dnsHost) || "google.com";
    const serverPart = dnsServer.trim() ? ` -Server ${sanitize(dnsServer)}` : "";
    const cmd =
      `try{$r=@(Resolve-DnsName -Name '${host}' -Type ${dnsType}${serverPart} -EA Stop` +
      ` | Select-Object Name,Type,TTL,` +
      `@{n='data';e={if($_.IPAddress){$_.IPAddress}` +
      `elseif($_.NameHost){$_.NameHost}` +
      `elseif($_.NameExchange){"$($_.Preference) $($_.NameExchange)"}` +
      `elseif($_.Strings){($_.Strings -join ';')}else{''}}});` +
      `if($r.Count -gt 0){$r | ConvertTo-Json -Compress}else{'[]'}}catch{'[]'}`;
    setDnsLoading(true);
    setDnsRecords([]);
    setDnsError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: cmd });
      const parsed = JSON.parse(raw.trim() || "[]");
      const arr = toArr<DnsRecord>(parsed);
      if (arr.length === 0) setDnsError("No records found.");
      else setDnsRecords(arr);
    } catch (err) {
      setDnsError(`${err}`);
    } finally {
      setDnsLoading(false);
    }
  };

  const runScan = async () => {
    const host = sanitize(scanHost) || "localhost";
    const custom = customPorts
      .split(",")
      .map((p) => parseInt(p.trim()))
      .filter((p) => !isNaN(p) && p > 0 && p < 65536);
    const allPorts = Array.from(new Set([...Array.from(selectedPorts), ...custom])).sort(
      (a, b) => a - b
    );
    if (allPorts.length === 0) return;
    const cmd =
      `$t="${host}";$ports=@(${allPorts.join(",")});` +
      `$r=@($ports | ForEach-Object {$p=$_;$tcp=New-Object System.Net.Sockets.TcpClient;` +
      `try{$c=$tcp.BeginConnect($t,$p,$null,$null);$w=$c.AsyncWaitHandle.WaitOne(500,$false);` +
      `if($w){try{$tcp.EndConnect($c);$o=$true}catch{$o=$false}}else{$o=$false}}` +
      `catch{$o=$false}finally{$tcp.Close()};@{port=$p;open=$o}});` +
      `$r | ConvertTo-Json -Compress`;
    setScanLoading(true);
    setScanResults([]);
    setScanError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: cmd });
      setScanResults(toArr<PortResult>(JSON.parse(raw.trim() || "[]")));
    } catch (err) {
      setScanError(`${err}`);
    } finally {
      setScanLoading(false);
    }
  };

  const togglePort = (port: number) =>
    setSelectedPorts((prev) => {
      const next = new Set(prev);
      next.has(port) ? next.delete(port) : next.add(port);
      return next;
    });

  const parsePingStats = (output: string) => ({
    sent: output.match(/Sent\s*=\s*(\d+)/i)?.[1] ?? null,
    received: output.match(/Received\s*=\s*(\d+)/i)?.[1] ?? null,
    lost: output.match(/Lost\s*=\s*(\d+)\s*\(/i)?.[1] ?? null,
    lostPct: output.match(/\((\d+)%\s*loss\)/i)?.[1] ?? null,
    min: output.match(/Minimum\s*=\s*(\d+)ms/i)?.[1] ?? null,
    max: output.match(/Maximum\s*=\s*(\d+)ms/i)?.[1] ?? null,
    avg: output.match(/Average\s*=\s*(\d+)ms/i)?.[1] ?? null,
  });

  const inputCls =
    "w-full bg-gray-700 text-gray-200 placeholder-gray-500 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const runBtn = (loading: boolean, label: string, loadLabel: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="px-5 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-sm font-semibold transition disabled:opacity-50 shrink-0"
    >
      {loading ? loadLabel : label}
    </button>
  );

  const errorBox = (msg: string) => (
    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400 text-sm">
      ❌ {msg}
    </div>
  );

  const terminalBox = (content: string, maxH = "max-h-96") => (
    <div className="bg-gray-800 rounded-lg p-4">
      <pre className={`text-xs font-mono text-gray-300 whitespace-pre-wrap break-words ${maxH} overflow-auto`}>
        {content}
      </pre>
    </div>
  );

  const tabs: { id: Tool; label: string; icon: string }[] = [
    { id: "ping",       label: "Ping",       icon: "📡" },
    { id: "traceroute", label: "Traceroute",  icon: "🗺️" },
    { id: "dns",        label: "DNS Lookup",  icon: "🔍" },
    { id: "portscan",   label: "Port Scan",   icon: "🔓" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🛰️ Network Tools</h2>
        <div className="text-gray-500 text-sm">4 diagnostic tools</div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTool(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              activeTool === t.id
                ? "bg-gray-800 text-white border-b-2 border-blue-500 -mb-px"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── PING ──────────────────────────────────────────────────────── */}
      {activeTool === "ping" && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-40">
                <label className="text-gray-400 text-xs mb-1 block">Host / IP</label>
                <input
                  type="text"
                  value={pingHost}
                  onChange={(e) => setPingHost(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runPing()}
                  placeholder="8.8.8.8 or hostname"
                  className={inputCls}
                />
              </div>
              <div className="w-28">
                <label className="text-gray-400 text-xs mb-1 block">Count (1–20)</label>
                <input
                  type="number"
                  value={pingCount}
                  onChange={(e) => setPingCount(e.target.value)}
                  min={1}
                  max={20}
                  className={inputCls}
                />
              </div>
              {runBtn(pingLoading, "▶ Ping", "⏳ Pinging...", runPing)}
            </div>
          </div>

          {pingError && errorBox(pingError)}

          {pingOutput && (() => {
            const s = parsePingStats(pingOutput);
            const lostNum = parseInt(s.lostPct ?? "0");
            const statColor = lostNum === 0 ? "text-green-400" : lostNum < 50 ? "text-yellow-400" : "text-red-400";
            const stats = [
              { label: "Sent",     value: s.sent ?? "—",                        color: "text-gray-300" },
              { label: "Received", value: s.received ?? "—",                    color: "text-green-400" },
              { label: "Lost",     value: s.lost ? `${s.lost} (${s.lostPct}%)` : "0", color: s.lost ? "text-red-400" : "text-gray-500" },
              { label: "Min",      value: s.min ? `${s.min}ms` : "—",           color: "text-blue-400" },
              { label: "Max",      value: s.max ? `${s.max}ms` : "—",           color: "text-blue-400" },
              { label: "Avg",      value: s.avg ? `${s.avg}ms` : "—",           color: statColor },
            ];
            return (
              <div className="space-y-3">
                {s.sent && (
                  <div className="bg-gray-800 rounded-lg p-4 grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                    {stats.map(({ label, value, color }) => (
                      <div key={label}>
                        <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
                        <div className="text-gray-500 text-xs">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
                {terminalBox(pingOutput, "max-h-64")}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TRACEROUTE ────────────────────────────────────────────────── */}
      {activeTool === "traceroute" && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-800 rounded p-3 text-yellow-400 text-xs">
              ⚠️ Traceroute can take 30–90 seconds if hops time out. Each hop uses -w 1000 (1s timeout).
            </div>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-40">
                <label className="text-gray-400 text-xs mb-1 block">Host / IP</label>
                <input
                  type="text"
                  value={traceHost}
                  onChange={(e) => setTraceHost(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runTraceroute()}
                  placeholder="8.8.8.8 or hostname"
                  className={inputCls}
                />
              </div>
              <div className="w-32">
                <label className="text-gray-400 text-xs mb-1 block">Max Hops (1–64)</label>
                <input
                  type="number"
                  value={traceMaxHops}
                  onChange={(e) => setTraceMaxHops(e.target.value)}
                  min={1}
                  max={64}
                  className={inputCls}
                />
              </div>
              {runBtn(traceLoading, "▶ Trace", "⏳ Tracing...", runTraceroute)}
            </div>
          </div>
          {traceError && errorBox(traceError)}
          {traceOutput && terminalBox(traceOutput)}
        </div>
      )}

      {/* ── DNS LOOKUP ────────────────────────────────────────────────── */}
      {activeTool === "dns" && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-40">
                <label className="text-gray-400 text-xs mb-1 block">Hostname</label>
                <input
                  type="text"
                  value={dnsHost}
                  onChange={(e) => setDnsHost(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runDns()}
                  placeholder="google.com"
                  className={inputCls}
                />
              </div>
              <div className="w-28">
                <label className="text-gray-400 text-xs mb-1 block">Record Type</label>
                <select
                  value={dnsType}
                  onChange={(e) => setDnsType(e.target.value)}
                  className={inputCls}
                >
                  {DNS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="w-36">
                <label className="text-gray-400 text-xs mb-1 block">DNS Server (optional)</label>
                <input
                  type="text"
                  value={dnsServer}
                  onChange={(e) => setDnsServer(e.target.value)}
                  placeholder="8.8.8.8"
                  className={inputCls}
                />
              </div>
              {runBtn(dnsLoading, "▶ Lookup", "⏳ Looking up...", runDns)}
            </div>
          </div>

          {dnsError && errorBox(dnsError)}

          {dnsRecords.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-xs mb-3">
                {dnsRecords.length} record{dnsRecords.length !== 1 ? "s" : ""} returned
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-700">
                      <th className="text-left py-2 pr-4 font-medium">Name</th>
                      <th className="text-left py-2 pr-4 font-medium">Type</th>
                      <th className="text-left py-2 pr-4 font-medium">TTL</th>
                      <th className="text-left py-2 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dnsRecords.map((r, i) => (
                      <tr key={i} className="border-b border-gray-700/50 last:border-0">
                        <td className="py-2 pr-4 text-gray-400 font-mono text-xs truncate max-w-36">{r.Name}</td>
                        <td className="py-2 pr-4">
                          <span className="bg-blue-900/50 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded text-xs font-semibold">
                            {r.Type}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{r.TTL}</td>
                        <td className="py-2 text-gray-200 font-mono text-xs break-all">{r.data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PORT SCAN ─────────────────────────────────────────────────── */}
      {activeTool === "portscan" && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="bg-blue-900/20 border border-blue-800 rounded p-3 text-blue-300 text-xs">
              ℹ️ Only scan hosts you own or have explicit permission to test. Uses 500ms TCP connect timeout per port.
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-gray-400 text-xs mb-1 block">Host / IP</label>
                <input
                  type="text"
                  value={scanHost}
                  onChange={(e) => setScanHost(e.target.value)}
                  placeholder="localhost or 192.168.1.1"
                  className={inputCls}
                />
              </div>
              {runBtn(
                scanLoading,
                "▶ Scan",
                "⏳ Scanning...",
                runScan,
                selectedPorts.size === 0 && !customPorts.trim()
              )}
            </div>

            <div>
              <div className="text-gray-400 text-xs mb-2">Common ports</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_PORTS.map((port) => (
                  <button
                    key={port}
                    type="button"
                    onClick={() => togglePort(port)}
                    className={`px-2 py-1 rounded text-xs font-mono transition ${
                      selectedPorts.has(port)
                        ? "bg-blue-700 text-white"
                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    }`}
                  >
                    {port} <span className="opacity-60">{PORT_SERVICES[port]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-1 block">Custom ports (comma-separated)</label>
              <input
                type="text"
                value={customPorts}
                onChange={(e) => setCustomPorts(e.target.value)}
                placeholder="e.g. 8080, 9090, 27017"
                className={inputCls}
              />
            </div>
          </div>

          {scanError && errorBox(scanError)}

          {scanResults.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-4 mb-3 text-xs">
                <span className="text-green-400 font-semibold">
                  ● {scanResults.filter((r) => r.open).length} open
                </span>
                <span className="text-gray-500">
                  ○ {scanResults.filter((r) => !r.open).length} closed
                </span>
                <span className="text-gray-600">
                  {scanResults.length} ports scanned
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {scanResults.map((r) => (
                  <div
                    key={r.port}
                    className={`flex items-center gap-2 p-2 rounded border text-xs font-mono ${
                      r.open
                        ? "bg-green-900/20 border-green-800 text-green-300"
                        : "bg-gray-700/50 border-gray-700 text-gray-600"
                    }`}
                  >
                    <span className="text-base leading-none">{r.open ? "●" : "○"}</span>
                    <div>
                      <div className="font-semibold">{r.port}</div>
                      <div className="opacity-60 text-xs">{PORT_SERVICES[r.port] ?? "custom"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DiagData {
  name: string;
  user: string;
  ip: string;
  os: string;
  uptime: string;
  domain: string;
  gateway: string;
  gwPing: boolean;
  dnsPing: boolean;
  inetPing: boolean;
  volumes: string[];
  errors: string[];
  lastKB: string;
  lastKBDate: string;
}

type Priority = "Low" | "Medium" | "High" | "Critical";

const PRIORITY_COLORS: Record<Priority, string> = {
  Low: "bg-gray-600 text-gray-200",
  Medium: "bg-blue-700 text-blue-200",
  High: "bg-orange-700 text-orange-200",
  Critical: "bg-red-700 text-red-200",
};

export default function TicketBuilder() {
  const [diagData, setDiagData] = useState<DiagData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Tech-entered fields
  const [issueDesc, setIssueDesc] = useState("");
  const [stepsTried, setStepsTried] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");

  const gatherDiagnostics = async () => {
    setLoading(true);
    setError(null);
    setDiagData(null);
    setCopied(false);

    const cmd =
      `$name=$env:COMPUTERNAME;` +
      `$user=$env:USERNAME;` +
      `$ip=(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike '*Loopback*'} | Select-Object -First 1).IPAddress;` +
      `$os=(Get-WmiObject Win32_OperatingSystem -EA SilentlyContinue).Caption + ' Build ' + (Get-WmiObject Win32_OperatingSystem -EA SilentlyContinue).BuildNumber;` +
      `$bt=(Get-CimInstance Win32_OperatingSystem -EA SilentlyContinue).LastBootUpTime;` +
      `$up=(Get-Date)-$bt;$upStr="$($up.Days)d $($up.Hours)h $($up.Minutes)m";` +
      `$domain=(Get-WmiObject Win32_ComputerSystem -EA SilentlyContinue).Domain;` +
      `$gw=(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -EA SilentlyContinue | Select-Object -First 1).NextHop;` +
      `$gwPing=if($gw){(Test-Connection -ComputerName $gw -Count 1 -Quiet -EA SilentlyContinue)}else{$false};` +
      `$dnsPing=(Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet -EA SilentlyContinue);` +
      `$inetPing=(Test-Connection -ComputerName 1.1.1.1 -Count 1 -Quiet -EA SilentlyContinue);` +
      `$vols=@(Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ForEach-Object {` +
      `$t=$_.Used+$_.Free;$pct=if($t -gt 0){[math]::Round($_.Used/$t*100,0)}else{0};` +
      `"$($_.Name): $pct% used ($([math]::Round($_.Free/1GB,1))GB free of $([math]::Round($t/1GB,1))GB)"});` +
      `$errs=@(Get-WinEvent -FilterHashtable @{LogName='System','Application';Level=1,2;StartTime=(Get-Date).AddHours(-24)} -MaxEvents 5 -EA SilentlyContinue | ` +
      `ForEach-Object {"[$($_.TimeCreated.ToString('yyyy-MM-dd HH:mm'))] $($_.LevelDisplayName.ToUpper()) | $($_.ProviderName) (ID: $($_.Id))"});` +
      `$hf=Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1;` +
      `@{name=$name;user=$user;ip="$ip";os=$os;uptime=$upStr;domain=$domain;` +
      `gateway="$gw";gwPing=$gwPing;dnsPing=$dnsPing;inetPing=$inetPing;` +
      `volumes=$vols;errors=$errs;` +
      `lastKB=$hf.HotFixID;lastKBDate=if($hf.InstalledOn){$hf.InstalledOn.ToString('yyyy-MM-dd')}else{'Unknown'}` +
      `} | ConvertTo-Json -Compress`;

    try {
      const result = await invoke<string>("run_custom_powershell", {
        command: cmd,
      });
      const parsed = JSON.parse(result.trim());
      setDiagData({
        name: parsed.name ?? "Unknown",
        user: parsed.user ?? "Unknown",
        ip: parsed.ip ?? "N/A",
        os: parsed.os ?? "Unknown",
        uptime: parsed.uptime ?? "Unknown",
        domain: parsed.domain ?? "N/A",
        gateway: parsed.gateway ?? "N/A",
        gwPing: !!parsed.gwPing,
        dnsPing: !!parsed.dnsPing,
        inetPing: !!parsed.inetPing,
        volumes: Array.isArray(parsed.volumes) ? parsed.volumes : parsed.volumes ? [parsed.volumes] : [],
        errors: Array.isArray(parsed.errors) ? parsed.errors : parsed.errors ? [parsed.errors] : [],
        lastKB: parsed.lastKB ?? "N/A",
        lastKBDate: parsed.lastKBDate ?? "Unknown",
      });
    } catch (err) {
      setError(`Failed to gather diagnostics: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const buildTicketText = (): string => {
    const now = new Date().toLocaleString();
    const bar = "═".repeat(54);
    const dash = "─".repeat(54);

    const ping = (ok: boolean) => (ok ? "✓ OK" : "✗ FAIL");

    const lines: string[] = [
      bar,
      "  DESKSOS DIAGNOSTIC REPORT",
      `  Generated: ${now}`,
      `  Priority: ${priority}`,
      bar,
      "",
    ];

    if (issueDesc.trim()) {
      lines.push("ISSUE DESCRIPTION", dash, issueDesc.trim(), "");
    }

    if (diagData) {
      lines.push(
        "MACHINE INFORMATION",
        dash,
        `Computer Name : ${diagData.name}`,
        `Logged-in User: ${diagData.user}`,
        `Domain        : ${diagData.domain}`,
        `IP Address    : ${diagData.ip}`,
        `OS            : ${diagData.os}`,
        `Uptime        : ${diagData.uptime}`,
        "",
        "NETWORK STATUS",
        dash,
        `Gateway (${diagData.gateway}): ${ping(diagData.gwPing)}`,
        `DNS (8.8.8.8)             : ${ping(diagData.dnsPing)}`,
        `Internet (1.1.1.1)        : ${ping(diagData.inetPing)}`,
        "",
        "DISK SPACE",
        dash,
        ...diagData.volumes,
        "",
        "RECENT ERRORS (Last 24h)",
        dash,
        ...(diagData.errors.length > 0
          ? diagData.errors
          : ["No critical errors found"]),
        "",
        "WINDOWS UPDATE",
        dash,
        `Last Update: ${diagData.lastKB} (${diagData.lastKBDate})`,
        "",
      );
    }

    if (stepsTried.trim()) {
      lines.push("STEPS ALREADY TRIED", dash, stepsTried.trim(), "");
    }

    lines.push(bar, "  Generated by DeskSOS", bar);

    return lines.join("\n");
  };

  const copyToClipboard = async () => {
    const text = buildTicketText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for environments where clipboard API may be restricted
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const ticketText = diagData ? buildTicketText() : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🎫 Ticket Builder</h2>
      </div>

      {/* Step 1 — Tech notes */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-bold text-cyan-400">
          1. Describe the Issue
        </h3>

        <div>
          <label className="block text-gray-400 text-sm mb-1">
            Issue Description
          </label>
          <textarea
            value={issueDesc}
            onChange={(e) => setIssueDesc(e.target.value)}
            placeholder="e.g. User unable to connect to shared drive, browser times out on all sites..."
            className="w-full bg-gray-700 text-white p-3 rounded-lg font-mono text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-1">
            Steps Already Tried
          </label>
          <textarea
            value={stepsTried}
            onChange={(e) => setStepsTried(e.target.value)}
            placeholder="e.g. Restarted machine, flushed DNS, confirmed cables connected..."
            className="w-full bg-gray-700 text-white p-3 rounded-lg font-mono text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-2">Priority</label>
          <div className="flex gap-2">
            {(["Low", "Medium", "High", "Critical"] as Priority[]).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriority(p)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  priority === p
                    ? PRIORITY_COLORS[p]
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 2 — Gather */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-cyan-400 mb-4">
          2. Gather Diagnostics
        </h3>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm mb-4">
            ❌ {error}
          </div>
        )}

        <button
          type="button"
          onClick={gatherDiagnostics}
          disabled={loading}
          className="w-full py-3 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
        >
          {loading
            ? "⏳ Gathering diagnostics..."
            : diagData
              ? "🔄 Re-gather Diagnostics"
              : "🔍 Gather Diagnostics"}
        </button>

        {diagData && !loading && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gray-700 rounded p-2">
              <span className="text-gray-400">Machine: </span>
              <span className="text-white">{diagData.name}</span>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <span className="text-gray-400">User: </span>
              <span className="text-white">{diagData.user}</span>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <span className="text-gray-400">IP: </span>
              <span className="text-white font-mono">{diagData.ip}</span>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <span className="text-gray-400">Network: </span>
              <span className={diagData.inetPing ? "text-green-400" : "text-red-400"}>
                {diagData.inetPing ? "✓ Online" : "✗ Offline"}
              </span>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <span className="text-gray-400">Errors (24h): </span>
              <span className={diagData.errors.length > 0 ? "text-orange-400" : "text-green-400"}>
                {diagData.errors.length}
              </span>
            </div>
            <div className="bg-gray-700 rounded p-2">
              <span className="text-gray-400">Last Update: </span>
              <span className="text-white">{diagData.lastKBDate}</span>
            </div>
          </div>
        )}
      </div>

      {/* Step 3 — Copy */}
      {diagData && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-cyan-400">
              3. Copy to Clipboard
            </h3>
            <button
              type="button"
              onClick={copyToClipboard}
              className={`px-6 py-2 rounded-lg font-semibold transition ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {copied ? "✅ Copied!" : "📋 Copy Ticket"}
            </button>
          </div>

          {/* Preview */}
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96 whitespace-pre leading-relaxed">
            {ticketText}
          </pre>
        </div>
      )}
    </div>
  );
}

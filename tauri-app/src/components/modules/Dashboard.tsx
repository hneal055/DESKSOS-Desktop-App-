import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SystemInfo {
  computer_name: string;
  os_version: string;
  ip_address: string;
  mac_address: string;
  disk_space_gb: string;
  memory_gb: string;
  uptime: string;
  domain: string;
  logged_in_user: string;
}

interface NetworkHealth {
  gateway_ping: boolean;
  dns_ping: boolean;
  internet_ping: boolean;
  vpn_status: string;
}

interface StartupHealth {
  diskWarning: boolean;   // any volume > 85% full
  diskDetail: string;
  errorCount: number;     // critical/error events in last 24h
  daysSinceUpdate: number;
  lastKB: string;
}

type CardStatus = "ok" | "warn" | "fail" | "unknown";

function StatusCard({
  icon,
  title,
  status,
  primary,
  secondary,
}: {
  icon: string;
  title: string;
  status: CardStatus;
  primary: string;
  secondary?: string;
}) {
  const border: Record<CardStatus, string> = {
    ok:      "border-green-700 bg-green-900/20",
    warn:    "border-yellow-700 bg-yellow-900/20",
    fail:    "border-red-700 bg-red-900/20",
    unknown: "border-gray-600 bg-gray-800",
  };
  const badge: Record<CardStatus, string> = {
    ok:      "bg-green-700 text-green-200",
    warn:    "bg-yellow-700 text-yellow-200",
    fail:    "bg-red-700 text-red-200",
    unknown: "bg-gray-600 text-gray-300",
  };
  const label: Record<CardStatus, string> = {
    ok:      "OK",
    warn:    "WARN",
    fail:    "FAIL",
    unknown: "...",
  };

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${border[status]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-gray-300 text-sm font-medium">{title}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge[status]}`}>
          {label[status]}
        </span>
      </div>
      <div className="text-white font-semibold text-sm leading-snug">{primary}</div>
      {secondary && (
        <div className="text-gray-400 text-xs">{secondary}</div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [netHealth, setNetHealth] = useState<NetworkHealth | null>(null);
  const [startup, setStartup] = useState<StartupHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(() => new Date());

  useEffect(() => {
    runStartupCheck();
  }, []);

  const runStartupCheck = async () => {
    setLoading(true);

    const diskCmd =
      `$warn=$false;$detail='';` +
      `Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ForEach-Object {` +
      `$t=$_.Used+$_.Free;$pct=if($t -gt 0){[math]::Round($_.Used/$t*100,0)}else{0};` +
      `if($pct -ge 85){$warn=$true;$detail+="$($_.Name): $pct% "}}; ` +
      `"$warn|$detail"`;

    const eventCmd =
      `@(Get-WinEvent -FilterHashtable @{LogName='System','Application';Level=1,2;` +
      `StartTime=(Get-Date).AddHours(-24)} -MaxEvents 100 -EA SilentlyContinue).Count`;

    const updateCmd =
      `$hf=Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1;` +
      `$days=if($hf.InstalledOn){[math]::Round(((Get-Date)-$hf.InstalledOn).TotalDays,0)}else{999};` +
      `"$days|$($hf.HotFixID)"`;

    try {
      const [sys, net, diskRaw, eventRaw, updateRaw] = await Promise.all([
        invoke<SystemInfo>("get_system_info"),
        invoke<NetworkHealth>("check_network_health"),
        invoke<string>("run_custom_powershell", { command: diskCmd }),
        invoke<string>("run_custom_powershell", { command: eventCmd }),
        invoke<string>("run_custom_powershell", { command: updateCmd }),
      ]);

      setSysInfo(sys);
      setNetHealth(net);

      // Parse disk
      const [diskWarnStr, diskDetail] = diskRaw.trim().split("|");
      const diskWarning = diskWarnStr.trim().toLowerCase() === "true";

      // Parse events
      const errorCount = parseInt(eventRaw.trim(), 10) || 0;

      // Parse update
      const [daysStr, lastKB] = updateRaw.trim().split("|");
      const daysSinceUpdate = parseInt(daysStr, 10) || 999;

      setStartup({ diskWarning, diskDetail: diskDetail?.trim() || "", errorCount, daysSinceUpdate, lastKB: lastKB?.trim() || "N/A" });
    } catch (err) {
      console.error("Startup check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Derive card statuses
  const networkStatus = (): CardStatus => {
    if (!netHealth) return "unknown";
    if (netHealth.internet_ping && netHealth.dns_ping && netHealth.gateway_ping) return "ok";
    if (netHealth.gateway_ping) return "warn";
    return "fail";
  };

  const networkPrimary = () => {
    if (!netHealth) return "Checking...";
    if (netHealth.internet_ping) return "Internet connected";
    if (netHealth.gateway_ping) return "Gateway OK — no internet";
    return "Gateway unreachable";
  };

  const diskStatus = (): CardStatus => {
    if (!startup) return "unknown";
    return startup.diskWarning ? "warn" : "ok";
  };

  const eventStatus = (): CardStatus => {
    if (!startup) return "unknown";
    if (startup.errorCount === 0) return "ok";
    if (startup.errorCount <= 5) return "warn";
    return "fail";
  };

  const updateStatus = (): CardStatus => {
    if (!startup) return "unknown";
    if (startup.daysSinceUpdate <= 30) return "ok";
    if (startup.daysSinceUpdate <= 60) return "warn";
    return "fail";
  };

  const greeting = () => {
    const h = startTime.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400">
        <div className="text-4xl animate-pulse">🔍</div>
        <div className="text-lg">Running startup diagnostics...</div>
        <div className="text-sm text-gray-500">Checking network, disk, events, and updates</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {greeting()}{sysInfo ? `, ${sysInfo.logged_in_user}` : ""}
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {sysInfo?.computer_name} &middot; {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          type="button"
          onClick={runStartupCheck}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatusCard
          icon="🌐"
          title="Network"
          status={networkStatus()}
          primary={networkPrimary()}
          secondary={netHealth?.vpn_status !== "Disconnected" ? `VPN: ${netHealth?.vpn_status}` : undefined}
        />
        <StatusCard
          icon="💾"
          title="Disk Space"
          status={diskStatus()}
          primary={startup?.diskWarning ? `Low space: ${startup.diskDetail}` : "All drives healthy"}
          secondary={sysInfo?.disk_space_gb ? `C: ${sysInfo.disk_space_gb}` : undefined}
        />
        <StatusCard
          icon="📋"
          title="Event Log (24h)"
          status={eventStatus()}
          primary={
            startup?.errorCount === 0
              ? "No critical errors"
              : `${startup?.errorCount} critical/error event${startup?.errorCount !== 1 ? "s" : ""}`
          }
          secondary="System + Application logs"
        />
        <StatusCard
          icon="🔄"
          title="Windows Update"
          status={updateStatus()}
          primary={
            startup?.daysSinceUpdate === 999
              ? "No update history found"
              : `Last updated ${startup?.daysSinceUpdate}d ago`
          }
          secondary={startup?.lastKB !== "N/A" ? startup?.lastKB : undefined}
        />
      </div>

      {/* Machine details */}
      {sysInfo && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Machine Info
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Computer", value: sysInfo.computer_name },
              { label: "Domain", value: sysInfo.domain },
              { label: "OS", value: sysInfo.os_version },
              { label: "IP Address", value: sysInfo.ip_address },
              { label: "Memory", value: sysInfo.memory_gb },
              { label: "Uptime", value: sysInfo.uptime },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-700 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-0.5">{label}</div>
                <div className="text-white text-sm font-medium truncate">{value || "N/A"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Fix {
  id: string;
  icon: string;
  title: string;
  desc: string;
  cmd: string;
  destructive: boolean;
  requiresReboot?: boolean;
}

interface FixState {
  loading: boolean;
  output: string | null;
  error: boolean;
}

const FIXES: Fix[] = [
  {
    id: "dns-flush",
    icon: "🗑️",
    title: "DNS Flush",
    desc: "Clear the DNS resolver cache to force fresh lookups.",
    cmd: "ipconfig /flushdns",
    destructive: false,
  },
  {
    id: "ip-release",
    icon: "📤",
    title: "IP Release",
    desc: "Release the current DHCP-assigned IP address.",
    cmd: "ipconfig /release",
    destructive: true,
  },
  {
    id: "ip-renew",
    icon: "📥",
    title: "IP Renew",
    desc: "Request a new IP address from the DHCP server.",
    cmd: "ipconfig /renew",
    destructive: false,
  },
  {
    id: "winsock-reset",
    icon: "🔌",
    title: "Winsock Reset",
    desc: "Reset Windows Sockets API to default state. Reboot required.",
    cmd: "netsh winsock reset",
    destructive: true,
    requiresReboot: true,
  },
  {
    id: "tcpip-reset",
    icon: "🌐",
    title: "TCP/IP Stack Reset",
    desc: "Reset TCP/IP stack to factory defaults. Reboot required.",
    cmd: "netsh int ip reset",
    destructive: true,
    requiresReboot: true,
  },
  {
    id: "arp-clear",
    icon: "🧹",
    title: "ARP Cache Clear",
    desc: "Clear the ARP cache to resolve MAC-to-IP mapping issues.",
    cmd: "arp -d *; Write-Output 'ARP cache cleared successfully.'",
    destructive: false,
  },
  {
    id: "netbios-reset",
    icon: "📡",
    title: "NetBIOS Reset",
    desc: "Reload the remote NetBIOS name cache from LMHOSTS file.",
    cmd: "nbtstat -R; Write-Output 'NetBIOS name cache reloaded.'",
    destructive: false,
  },
  {
    id: "dhcp-restart",
    icon: "🔄",
    title: "DHCP Client Restart",
    desc: "Restart the DHCP Client service to resolve IP assignment issues.",
    cmd: "Restart-Service Dhcp -Force; Write-Output 'DHCP Client service restarted.'",
    destructive: true,
  },
  {
    id: "adapter-reset",
    icon: "🔁",
    title: "Network Adapter Reset",
    desc: "Disable then re-enable all active adapters (brief connectivity loss).",
    cmd:
      "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object {" +
      "$n=$_.Name; Disable-NetAdapter -Name $n -Confirm:$false; " +
      "Start-Sleep -Seconds 2; Enable-NetAdapter -Name $n -Confirm:$false}; " +
      "Write-Output 'Network adapter reset complete.'",
    destructive: true,
  },
  {
    id: "route-table",
    icon: "🗺️",
    title: "Route Table",
    desc: "Display the current IP routing table (read-only).",
    cmd: "route print",
    destructive: false,
  },
  {
    id: "firewall-status",
    icon: "🛡️",
    title: "Firewall Status",
    desc: "Show firewall profile status for Domain, Private, and Public networks.",
    cmd: "Get-NetFirewallProfile | Format-Table Name,Enabled,DefaultInboundAction,DefaultOutboundAction -AutoSize | Out-String",
    destructive: false,
  },
  {
    id: "proxy-reset",
    icon: "🔓",
    title: "Proxy Settings Reset",
    desc: "Reset WinHTTP proxy settings to direct (no proxy) connection.",
    cmd: "netsh winhttp reset proxy",
    destructive: false,
  },
  {
    id: "network-profile",
    icon: "🏠",
    title: "Network Profile",
    desc: "Show current network connection profiles and connectivity status.",
    cmd: "Get-NetConnectionProfile | Format-Table Name,NetworkCategory,IPv4Connectivity,IPv6Connectivity -AutoSize | Out-String",
    destructive: false,
  },
  {
    id: "dns-servers",
    icon: "🔍",
    title: "DNS Server Info",
    desc: "Display configured DNS server addresses for all adapters.",
    cmd: "Get-DnsClientServerAddress | Where-Object {$_.AddressFamily -eq 2} | Format-Table InterfaceAlias,ServerAddresses -AutoSize | Out-String",
    destructive: false,
  },
  {
    id: "full-reset",
    icon: "💥",
    title: "Complete Stack Reset",
    desc: "Reset Winsock + TCP/IP stack together. Reboot required afterward.",
    cmd: "netsh winsock reset; netsh int ip reset; Write-Output 'Full network stack reset complete. Please reboot the system.'",
    destructive: true,
    requiresReboot: true,
  },
];

export default function NetworkFixes() {
  const [states, setStates] = useState<Record<string, FixState>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const anyLoading = Object.values(states).some((s) => s.loading);

  const runFix = async (fix: Fix) => {
    if (fix.destructive && confirmId !== fix.id) {
      setConfirmId(fix.id);
      return;
    }
    setConfirmId(null);
    setStates((prev) => ({
      ...prev,
      [fix.id]: { loading: true, output: null, error: false },
    }));
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: fix.cmd });
      setStates((prev) => ({
        ...prev,
        [fix.id]: { loading: false, output: raw.trim() || "Done.", error: false },
      }));
    } catch (err) {
      setStates((prev) => ({
        ...prev,
        [fix.id]: { loading: false, output: `${err}`, error: true },
      }));
    }
  };

  const clearOutput = (id: string) => {
    setStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🔧 Network Fixes</h2>
        <div className="text-gray-500 text-sm">15 repair tools</div>
      </div>

      {/* Warning banner */}
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 text-yellow-400 text-sm flex items-start gap-2">
        <span className="shrink-0">⚠️</span>
        <span>
          Destructive operations (marked in orange) may briefly interrupt connectivity.
          Click once to arm, click again to confirm.
        </span>
      </div>

      {/* Grid of fix cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIXES.map((fix) => {
          const state = states[fix.id];
          const isLoading = state?.loading ?? false;
          const hasOutput = state && !state.loading && state.output !== null;
          const isConfirming = confirmId === fix.id;

          return (
            <div
              key={fix.id}
              className={`bg-gray-800 rounded-lg border flex flex-col ${
                fix.destructive ? "border-orange-900/60" : "border-gray-700"
              } ${isLoading ? "opacity-75" : ""}`}
            >
              {/* Card body */}
              <div className="p-4 flex-1">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-2xl shrink-0">{fix.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-200 font-semibold text-sm">{fix.title}</span>
                      {fix.destructive && (
                        <span className="text-xs bg-orange-900/60 text-orange-300 border border-orange-800 px-1.5 py-0.5 rounded">
                          Write
                        </span>
                      )}
                      {fix.requiresReboot && (
                        <span className="text-xs bg-red-900/60 text-red-300 border border-red-800 px-1.5 py-0.5 rounded">
                          Reboot
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">{fix.desc}</div>
                  </div>
                </div>
              </div>

              {/* Output area */}
              {hasOutput && (
                <div className="px-4 pb-2">
                  <pre
                    className={`text-xs font-mono rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words ${
                      state.error
                        ? "bg-red-950 text-red-300"
                        : "bg-gray-900 text-green-400"
                    }`}
                  >
                    {state.output}
                  </pre>
                </div>
              )}

              {/* Action footer */}
              <div className="px-4 pb-4 flex items-center gap-2">
                {isConfirming ? (
                  <>
                    <button
                      type="button"
                      onClick={() => runFix(fix)}
                      disabled={anyLoading}
                      className="flex-1 py-2 rounded bg-orange-700 hover:bg-orange-600 text-white text-sm font-bold transition disabled:opacity-50"
                    >
                      ⚠️ Confirm Run
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => runFix(fix)}
                      disabled={isLoading || anyLoading}
                      className={`flex-1 py-2 rounded text-sm font-semibold transition disabled:opacity-50 ${
                        fix.destructive
                          ? "bg-orange-900/50 hover:bg-orange-800 text-orange-200 border border-orange-800"
                          : "bg-blue-700 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {isLoading ? "⏳ Running..." : "▶ Run"}
                    </button>
                    {hasOutput && (
                      <button
                        type="button"
                        onClick={() => clearOutput(fix.id)}
                        className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs transition"
                        title="Clear output"
                      >
                        ✕
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

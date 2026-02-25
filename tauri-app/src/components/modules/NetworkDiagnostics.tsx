import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface NetworkConfig {
  hostname: string;
  ipv4: string;
  ipv6: string;
  gateway: string;
  dns: string;
  mac: string;
  dhcp: boolean;
}

interface DiagnosticResult {
  name: string;
  status: "success" | "failed" | "running";
  message: string;
}

export default function NetworkDiagnostics() {
  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadNetworkConfig();
  }, []);

  const loadNetworkConfig = async () => {
    setLoading(true);
    setIsExpanded(true);
    setDiagnostics([]);

    try {
      const result = await invoke<string>("run_custom_powershell", {
        command: "ipconfig /all",
      });

      const lines = result.split("\n");

      const hostname =
        lines.find((l) => l.includes("Host Name"))?.split(":")[1]?.trim() ||
        "Unknown";
      const ipv4Match = lines.find((l) => l.includes("IPv4 Address"));
      const ipv4 = ipv4Match
        ? ipv4Match.split(":")[1]?.trim().replace("(Preferred)", "").trim()
        : "N/A";
      const ipv6Match = lines.find((l) => l.includes("IPv6 Address"));
      const ipv6 = ipv6Match
        ? ipv6Match.split(":")[1]?.trim().replace("(Preferred)", "").trim()
        : "N/A";
      const gatewayMatch = lines.find((l) => l.includes("Default Gateway"));
      const gateway = gatewayMatch
        ? gatewayMatch.split(":")[1]?.trim()
        : "N/A";
      const dnsMatch = lines.find((l) => l.includes("DNS Servers"));
      const dns = dnsMatch ? dnsMatch.split(":")[1]?.trim() : "N/A";
      const macMatch = lines.find((l) => l.includes("Physical Address"));
      const mac = macMatch ? macMatch.split(":")[1]?.trim() : "N/A";
      const dhcp = lines.some(
        (l) => l.includes("DHCP Enabled") && l.includes("Yes")
      );

      setConfig({ hostname, ipv4, ipv6, gateway, dns, mac, dhcp });

      if (gateway && gateway !== "N/A") {
        await runDiagnostics(gateway);
      }
    } catch (error) {
      console.error("Failed to load network config:", error);
      setDiagnostics([
        {
          name: "Network Configuration",
          status: "failed",
          message: `Error: ${error}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async (gateway: string) => {
    setDiagnostics([
      {
        name: "Gateway Ping",
        status: "running",
        message: "Testing gateway connectivity...",
      },
    ]);

    try {
      // Test 1: Ping Gateway
      const pingResult = await invoke<string>("run_custom_powershell", {
        command: `ping -n 4 ${gateway}`,
      });
      const pingSuccess = pingResult.includes("Reply from");
      const lostMatch = pingResult.match(/Lost = (\d+)/);
      const lostPackets = lostMatch ? lostMatch[1] : "0";

      setDiagnostics((prev) =>
        prev.map((d) =>
          d.name === "Gateway Ping"
            ? {
                ...d,
                status: pingSuccess ? "success" : "failed",
                message: pingSuccess
                  ? `Gateway reachable (${lostPackets} packets lost)`
                  : "Gateway unreachable",
              }
            : d
        )
      );

      // Test 2: DNS Resolution
      setDiagnostics((prev) => [
        ...prev,
        {
          name: "DNS Resolution",
          status: "running",
          message: "Testing DNS servers...",
        },
      ]);

      const dnsResult = await invoke<string>("run_custom_powershell", {
        command: "nslookup google.com",
      });
      const dnsSuccess =
        dnsResult.includes("Address:") && !dnsResult.includes("server failed");

      setDiagnostics((prev) =>
        prev.map((d) =>
          d.name === "DNS Resolution"
            ? {
                ...d,
                status: dnsSuccess ? "success" : "failed",
                message: dnsSuccess
                  ? "DNS working correctly"
                  : "DNS resolution failed",
              }
            : d
        )
      );

      // Test 3: Internet Connectivity
      setDiagnostics((prev) => [
        ...prev,
        {
          name: "Internet Connectivity",
          status: "running",
          message: "Testing internet connection...",
        },
      ]);

      const internetResult = await invoke<string>("run_custom_powershell", {
        command: "ping -n 2 8.8.8.8",
      });
      const internetSuccess = internetResult.includes("Reply from");

      setDiagnostics((prev) =>
        prev.map((d) =>
          d.name === "Internet Connectivity"
            ? {
                ...d,
                status: internetSuccess ? "success" : "failed",
                message: internetSuccess
                  ? "Connected to internet"
                  : "No internet connection",
              }
            : d
        )
      );
    } catch (error) {
      setDiagnostics((prev) => [
        ...prev,
        {
          name: "Diagnostic Error",
          status: "failed",
          message: `Error running diagnostics: ${error}`,
        },
      ]);
    }
  };

  const statusIcon = (status: DiagnosticResult["status"]) => {
    if (status === "success") return "✅";
    if (status === "failed") return "❌";
    return "⏳";
  };

  return (
    <div className="space-y-6">
      {/* Run Diagnostics Button */}
      <button
        onClick={loadNetworkConfig}
        disabled={loading}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "⏳ Running Diagnostics..." : "🔍 Run Network Diagnostics"}
      </button>

      {isExpanded && (
        <>
          {/* IP Configuration */}
          {config && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-blue-400 mb-4">
                🖥️ IP Configuration
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Hostname", value: config.hostname },
                  { label: "IPv4 Address", value: config.ipv4 },
                  { label: "IPv6 Address", value: config.ipv6 },
                  { label: "Gateway", value: config.gateway },
                  { label: "DNS Servers", value: config.dns },
                  { label: "MAC Address", value: config.mac },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-700 p-3 rounded">
                    <div className="text-gray-400 text-xs mb-1">{label}</div>
                    <div className="text-white font-mono text-sm truncate">
                      {value || "N/A"}
                    </div>
                  </div>
                ))}
                <div className="bg-gray-700 p-3 rounded col-span-2">
                  <div className="text-gray-400 text-xs mb-1">DHCP</div>
                  <div
                    className={`font-semibold ${config.dhcp ? "text-green-400" : "text-red-400"}`}
                  >
                    {config.dhcp ? "✓ Enabled" : "✗ Disabled (Static IP)"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Results */}
          {diagnostics.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-bold text-purple-400 mb-4">
                📡 Diagnostic Results
              </h3>
              <div className="space-y-3">
                {diagnostics.map((test, i) => (
                  <div
                    key={i}
                    className="flex items-center bg-gray-700 p-4 rounded-lg"
                  >
                    <span className="text-xl mr-3">{statusIcon(test.status)}</span>
                    <div>
                      <div className="text-white font-medium">{test.name}</div>
                      <div className="text-gray-400 text-sm">{test.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

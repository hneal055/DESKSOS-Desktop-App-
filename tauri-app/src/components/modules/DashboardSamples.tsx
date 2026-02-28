import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TopProc {
  name: string;
  mb: number;
}

interface Metrics {
  uptime: string;
  cpu: number;
  memPct: number;
  memTotalMB: number;
  memFreeMB: number;
  diskPct: number;
  diskFreeGB: number;
  netOk: boolean;
  stoppedCrit: number;
  errors: number;
  topProc: TopProc | null;
  sessions: number;
  tempC: number; // -1 = unavailable
}

// Gathers all 10 widget metrics in one PS call
const SAMPLES_CMD =
  `$os=Get-CimInstance Win32_OperatingSystem;` +
  `$up=(Get-Date)-$os.LastBootUpTime;` +
  `$uStr='{0}d {1}h {2}m' -f [int]$up.TotalDays,$up.Hours,$up.Minutes;` +
  `$cpu=[math]::Round((Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average,0);` +
  `$mPct=[math]::Round(100-$os.FreePhysicalMemory/$os.TotalVisibleMemorySize*100,0);` +
  `$mTot=[math]::Round($os.TotalVisibleMemorySize/1024,0);` +
  `$mFre=[math]::Round($os.FreePhysicalMemory/1024,0);` +
  `$c=Get-PSDrive C;` +
  `$dPct=[math]::Round($c.Used/($c.Used+$c.Free)*100,0);` +
  `$dFre=[math]::Round($c.Free/1GB,1);` +
  `$net=try{Test-Connection 8.8.8.8 -Count 1 -Quiet}catch{$false};` +
  `$cs=@('Dhcp','Dnscache','RpcSs','EventLog','Schedule');` +
  `$sc=@($cs | ForEach-Object {Get-Service $_ -EA SilentlyContinue} | Where-Object {$_.Status -ne 'Running'}).Count;` +
  `$ec=@(Get-WinEvent -FilterHashtable @{LogName='System','Application';Level=1,2;StartTime=(Get-Date).AddHours(-24)} -MaxEvents 200 -EA SilentlyContinue).Count;` +
  `$tp=Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 1 | ` +
  `Select-Object @{n='name';e={$_.ProcessName}},@{n='mb';e={[math]::Round($_.WorkingSet64/1MB,0)}};` +
  `$ses=try{@(query session 2>&1 | Where-Object {$_ -match 'Active|Disc'}).Count}catch{0};` +
  `$tmp=try{[math]::Round(((Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature ` +
  `-EA Stop | Sort-Object CurrentTemperature -Descending | Select-Object -First 1).CurrentTemperature-2732)/10,0)}catch{-1};` +
  `@{uptime=$uStr;cpu=[int]$cpu;memPct=[int]$mPct;memTotalMB=[int]$mTot;memFreeMB=[int]$mFre;` +
  `diskPct=[int]$dPct;diskFreeGB=$dFre;netOk=$net;stoppedCrit=[int]$sc;errors=[int]$ec;` +
  `topProc=$tp;sessions=[int]$ses;tempC=[int]$tmp} | ConvertTo-Json -Compress`;

const gauge = (pct: number, warn = 75, crit = 90) => {
  if (pct >= crit) return { bar: "bg-red-500", text: "text-red-400" };
  if (pct >= warn) return { bar: "bg-yellow-500", text: "text-yellow-400" };
  return { bar: "bg-blue-500", text: "text-blue-400" };
};

function MiniBar({
  pct,
  warn,
  crit,
}: {
  pct: number;
  warn?: number;
  crit?: number;
}) {
  const c = gauge(pct, warn, crit);
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
      <div
        className={`h-2 rounded-full transition-all ${c.bar}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

interface WidgetProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  accent?: string;
}

function Widget({ icon, title, children, accent = "text-blue-400" }: WidgetProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 flex flex-col gap-2 border border-gray-700">
      <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wide">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div className={accent}>{children}</div>
    </div>
  );
}

export default function DashboardSamples() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await invoke<string>("run_custom_powershell", { command: SAMPLES_CMD });
      const p = JSON.parse(raw.trim());
      setMetrics({
        uptime: p.uptime ?? "—",
        cpu: p.cpu ?? 0,
        memPct: p.memPct ?? 0,
        memTotalMB: p.memTotalMB ?? 0,
        memFreeMB: p.memFreeMB ?? 0,
        diskPct: p.diskPct ?? 0,
        diskFreeGB: p.diskFreeGB ?? 0,
        netOk: p.netOk ?? false,
        stoppedCrit: p.stoppedCrit ?? 0,
        errors: p.errors ?? 0,
        topProc: p.topProc ?? null,
        sessions: p.sessions ?? 0,
        tempC: p.tempC ?? -1,
      });
    } catch (err) {
      setError(`${err}`);
    } finally {
      setLoading(false);
    }
  };

  const cpuC = gauge(metrics?.cpu ?? 0, 70, 90);
  const memC = gauge(metrics?.memPct ?? 0, 75, 90);
  const diskC = gauge(metrics?.diskPct ?? 0, 75, 90);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🎛️ Dashboard Samples</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
        >
          {loading ? "⏳ Gathering..." : metrics ? "🔄 Refresh" : "▶ Load All Widgets"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400">
          ❌ {error}
        </div>
      )}

      {!metrics && !loading && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎛️</div>
          <div className="text-gray-400 text-lg mb-2">10 live system widgets</div>
          <div className="text-gray-600 text-sm">
            Click "Load All Widgets" to gather all metrics in one scan.
          </div>
          <div className="text-gray-700 text-xs mt-1">
            Includes a network ping — may take 5–8 seconds.
          </div>
        </div>
      )}

      {loading && !metrics && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <div>Gathering system metrics...</div>
          <div className="text-gray-600 text-xs mt-1">This may take 5–8 seconds.</div>
        </div>
      )}

      {/* 10 Widgets grid */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* 1. System Uptime */}
          <Widget icon="⏱️" title="System Uptime" accent="text-cyan-400">
            <div className="text-xl font-bold font-mono">{metrics.uptime}</div>
            <div className="text-gray-500 text-xs mt-1">since last reboot</div>
          </Widget>

          {/* 2. CPU Usage Gauge */}
          <Widget icon="⚙️" title="CPU Usage" accent={cpuC.text}>
            <div className="text-3xl font-bold">{metrics.cpu}%</div>
            <MiniBar pct={metrics.cpu} warn={70} crit={90} />
            <div className="text-gray-600 text-xs mt-1">current load</div>
          </Widget>

          {/* 3. Memory Usage Bar */}
          <Widget icon="💾" title="Memory" accent={memC.text}>
            <div className="text-3xl font-bold">{metrics.memPct}%</div>
            <MiniBar pct={metrics.memPct} />
            <div className="text-gray-600 text-xs mt-1">
              {((metrics.memTotalMB - metrics.memFreeMB) / 1024).toFixed(1)} /{" "}
              {(metrics.memTotalMB / 1024).toFixed(1)} GB
            </div>
          </Widget>

          {/* 4. Disk Space Summary */}
          <Widget icon="💿" title="Disk C:" accent={diskC.text}>
            <div className="text-3xl font-bold">{metrics.diskPct}%</div>
            <MiniBar pct={metrics.diskPct} />
            <div className="text-gray-600 text-xs mt-1">
              {metrics.diskFreeGB} GB free
            </div>
          </Widget>

          {/* 5. Network Status */}
          <Widget
            icon="🌐"
            title="Network"
            accent={metrics.netOk ? "text-green-400" : "text-red-400"}
          >
            <div className="text-2xl font-bold">
              {metrics.netOk ? "Online" : "Offline"}
            </div>
            <div className="text-gray-600 text-xs mt-1">
              {metrics.netOk ? "8.8.8.8 reachable" : "Ping failed"}
            </div>
          </Widget>

          {/* 6. Service Health */}
          <Widget
            icon="🔧"
            title="Service Health"
            accent={metrics.stoppedCrit === 0 ? "text-green-400" : "text-red-400"}
          >
            <div className="text-2xl font-bold">
              {metrics.stoppedCrit === 0 ? "✓ OK" : `${metrics.stoppedCrit} down`}
            </div>
            <div className="text-gray-600 text-xs mt-1">
              {metrics.stoppedCrit === 0
                ? "All critical services running"
                : "Critical services not running"}
            </div>
          </Widget>

          {/* 7. Error Count */}
          <Widget
            icon="⚠️"
            title="Errors (24h)"
            accent={
              metrics.errors === 0
                ? "text-green-400"
                : metrics.errors > 10
                ? "text-red-400"
                : "text-yellow-400"
            }
          >
            <div className="text-3xl font-bold">{metrics.errors}</div>
            <div className="text-gray-600 text-xs mt-1">System + App log errors</div>
          </Widget>

          {/* 8. Top Process */}
          <Widget icon="📊" title="Top Process" accent="text-purple-400">
            {metrics.topProc ? (
              <>
                <div className="text-lg font-bold font-mono truncate">
                  {metrics.topProc.name}
                </div>
                <div className="text-gray-500 text-sm mt-1">
                  {metrics.topProc.mb.toLocaleString()} MB
                </div>
              </>
            ) : (
              <div className="text-gray-500">—</div>
            )}
          </Widget>

          {/* 9. User Sessions */}
          <Widget icon="👤" title="User Sessions" accent="text-orange-400">
            <div className="text-3xl font-bold">{metrics.sessions}</div>
            <div className="text-gray-600 text-xs mt-1">
              Active / Disconnected
            </div>
          </Widget>

          {/* 10. System Temperature */}
          <Widget
            icon="🌡️"
            title="Temperature"
            accent={
              metrics.tempC === -1
                ? "text-gray-500"
                : metrics.tempC > 85
                ? "text-red-400"
                : metrics.tempC > 70
                ? "text-yellow-400"
                : "text-green-400"
            }
          >
            {metrics.tempC === -1 ? (
              <>
                <div className="text-2xl font-bold">N/A</div>
                <div className="text-gray-600 text-xs mt-1">
                  Sensor not available
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{metrics.tempC}°C</div>
                <div className="text-gray-600 text-xs mt-1">
                  {metrics.tempC > 85
                    ? "⚠️ Critically hot"
                    : metrics.tempC > 70
                    ? "Warm"
                    : "Normal"}
                </div>
              </>
            )}
          </Widget>
        </div>
      )}

      {metrics && (
        <div className="text-gray-700 text-xs text-center">
          CPU load is a point-in-time snapshot · Temperature sensor support varies by hardware
        </div>
      )}
    </div>
  );
}

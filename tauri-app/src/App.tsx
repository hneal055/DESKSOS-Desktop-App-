import { useState, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import Login from "./components/Login";
import { invoke } from "@tauri-apps/api/core";
import "./styles.css";
import Dashboard from "./components/modules/Dashboard";
import NetworkDiagnostics from "./components/modules/NetworkDiagnostics";
import EventLog from "./components/modules/EventLog";
import DiskHealth from "./components/modules/DiskHealth";
import DiskSpace from "./components/modules/DiskSpace";
import RecentErrors from "./components/modules/RecentErrors";
import InstalledSoftware from "./components/modules/InstalledSoftware";
import WindowsUpdate from "./components/modules/WindowsUpdate";
import TicketBuilder from "./components/modules/TicketBuilder";
import NetworkAdapters from "./components/modules/NetworkAdapters";
import RunningServices from "./components/modules/RunningServices";
import MemoryConsumers from "./components/modules/MemoryConsumers";
import DashboardSamples from "./components/modules/DashboardSamples";
import NetworkFixes from "./components/modules/NetworkFixes";
import RemoteSession from "./components/modules/RemoteSession";
import Chat from "./components/modules/Chat";


// Command results are often plain strings; show them as text, not JSON
export function formatResult(res: unknown): string {
  if (typeof res === "string") return res.trim();
  if (res === null || res === undefined) return "done";
  return JSON.stringify(res);
}

// Windows refuses network resets, spooler control and other processes' kills
// unless the app runs as administrator; say so up front instead of failing.
const ADMIN_CHECK =
  "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)";

function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    invoke("run_custom_powershell", { command: ADMIN_CHECK })
      .then((out) => setIsAdmin(String(out).trim().toLowerCase() === "true"))
      .catch(() => setIsAdmin(null));
  }, []);
  return isAdmin;
}

export function AdminNotice({ isAdmin, what }: { isAdmin: boolean | null; what: string }) {
  if (isAdmin !== false) return null;
  return (
    <div role="note" className="bg-amber-900/40 border border-amber-600 rounded p-3 text-amber-200 text-sm">
      ⚠️ DeskSOS isn't running as administrator, so {what} will fail. Close DeskSOS, right-click it in the Start menu → <b>Run as administrator</b>.
    </div>
  );
}

// Disruptive actions need a second click: first arms, then Confirm or Cancel
export function ConfirmButton({ label, warning, onConfirm, disabled, danger = false }: {
  label: string; warning: string; onConfirm: () => void; disabled?: boolean; danger?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const base = danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700";
  if (!armed) {
    return <button type="button" onClick={() => setArmed(true)} disabled={disabled} className={`px-4 py-3 rounded ${base} text-white font-semibold`}>{label}</button>;
  }
  return (
    <div className="rounded border border-amber-500 bg-gray-900 p-2 space-y-2">
      <div className="text-amber-300 text-xs">{warning}</div>
      <div className="flex gap-2">
        <button type="button" onClick={() => { setArmed(false); onConfirm(); }} className="flex-1 px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold">⚠️ Confirm {label}</button>
        <button type="button" onClick={() => setArmed(false)} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm">Cancel</button>
      </div>
    </div>
  );
}

export function FixItModule() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = useIsAdmin();

  const runAction = async (action: string, command: () => Promise<any>) => {
    setLoading(true);
    setResult("");
    try {
      const res = await command();
      setResult(`✓ ${action}: ${formatResult(res)}`);
    } catch (err) {
      setResult(`✗ ${action} failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminNotice isAdmin={isAdmin} what="Renew IP, Reset Network, Restart Spooler and Clear Queue" />
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-purple-400 mb-4">🌐 Quick Network Fixes</h2>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => runAction("Flush DNS", () => invoke("flush_dns"))} disabled={loading} className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">Flush DNS</button>
          <ConfirmButton label="Renew IP" warning="The network drops for a few seconds." onConfirm={() => runAction("Renew IP", () => invoke("renew_ip"))} disabled={loading} />
          <ConfirmButton label="Reset Network" danger warning="Resets network settings to defaults. A reboot is needed afterwards." onConfirm={() => runAction("Reset Network", () => invoke("reset_network"))} disabled={loading} />
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">🖨️ Printer Rescue</h2>
        <div className="grid grid-cols-2 gap-3">
          <ConfirmButton label="Restart Spooler" warning="Printing pauses briefly." onConfirm={() => runAction("Restart Spooler", () => invoke("restart_print_spooler"))} disabled={loading} />
          <ConfirmButton label="Clear Queue" danger warning="Deletes every waiting print job on this PC. Warn the user first." onConfirm={() => runAction("Clear Queue", () => invoke("clear_print_queue"))} disabled={loading} />
        </div>
      </div>

      {result && <div className="bg-gray-700 rounded p-4 text-gray-300 whitespace-pre-wrap">{result}</div>}
    </div>
  );
}

export function ProcessModule() {
  const [processes, setProcesses]: any = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmPid, setConfirmPid] = useState<number | null>(null);
  const isAdmin = useIsAdmin();

  const kill = async (pid: number) => {
    setConfirmPid(null);
    try { await invoke("kill_process", { pid }); loadProcesses(); } catch (e) { alert(e); }
  };

  const loadProcesses = async () => {
    setLoading(true);
    try {
      const procs = await invoke("get_top_processes", { limit: 10 });
      setProcesses(procs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProcesses();
  }, []);

  return (
    <div className="space-y-6">
      <AdminNotice isAdmin={isAdmin} what="ending system processes or other users' processes" />
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">📊 Top Processes</h2>
        <button type="button" onClick={loadProcesses} disabled={loading} className="mb-4 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Refresh</button>
        <div className="space-y-2">
          {processes.map((p: any, i: number) => (
            <div key={i} className="bg-gray-700 p-3 rounded flex justify-between items-center">
              <div>
                <div className="text-white font-semibold">{p.name}</div>
                <div className="text-gray-400 text-sm">PID: {p.pid} | CPU: {p.cpu_percent}% | Memory: {p.memory_mb}MB</div>
              </div>
              {confirmPid === p.pid ? (
                <div className="flex items-center gap-2">
                  <span className="text-amber-300 text-xs">End {p.name}? Unsaved work in it is lost.</span>
                  <button type="button" onClick={() => kill(p.pid)} className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold">⚠️ Confirm Kill</button>
                  <button type="button" onClick={() => setConfirmPid(null)} className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm">Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmPid(p.pid)} className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm">Kill</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PowerShellModule() {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const runCommand = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setOutput("");
    try {
      const result = await invoke("run_custom_powershell", { command });
      setOutput(result as string);
    } catch (err) {
      setOutput(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">💻 PowerShell Console</h2>
        <textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Enter PowerShell command..." className="w-full bg-gray-700 text-white p-3 rounded font-mono h-32 mb-3" />
        <button type="button" onClick={runCommand} disabled={loading} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">{loading ? "Running..." : "Execute"}</button>
        {output && <pre className="mt-4 bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">{output}</pre>}
      </div>
    </div>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const [activeModule, setActiveModule] = useState("dashboard");
  // Pages stay mounted once opened (hidden when not active), so switching
  // away doesn't lose a half-written ticket or a running session
  const [visited, setVisited] = useState<string[]>(["dashboard"]);
  const open = (id: string) => {
    setActiveModule(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
  };

  const modules = [
    { id: "dashboard",  name: "🏠 Dashboard",   component: <Dashboard /> },
    { id: "network",    name: "🌐 Network",      component: <NetworkDiagnostics /> },
    { id: "adapters",   name: "🔌 Adapters",     component: <NetworkAdapters /> },
    { id: "eventlog",   name: "📋 Event Log",    component: <EventLog /> },
    { id: "errors",     name: "🚨 Errors",       component: <RecentErrors /> },
    { id: "diskhealth", name: "💾 Disk Health",  component: <DiskHealth /> },
    { id: "diskspace",  name: "🗂️ Disk Space",  component: <DiskSpace /> },
    { id: "memory",     name: "🧠 Memory",       component: <MemoryConsumers /> },
    { id: "processes",  name: "📊 Processes",    component: <ProcessModule /> },
    { id: "software",   name: "📦 Software",     component: <InstalledSoftware /> },
    { id: "services",   name: "🧰 Services",     component: <RunningServices /> },
    { id: "updates",    name: "🔄 Updates",      component: <WindowsUpdate /> },
    { id: "ticket",     name: "🎫 Ticket",       component: <TicketBuilder /> },
    { id: "fixit",      name: "🔧 Fix It",       component: <FixItModule /> },
    { id: "netfixes",   name: "🛠️ Net Fixes",   component: <NetworkFixes /> },
    { id: "samples",    name: "🎛️ Samples",     component: <DashboardSamples /> },
    { id: "powershell", name: "💻 PowerShell",   component: <PowerShellModule /> },
    { id: "remote",     name: "📡 Remote",        component: <RemoteSession /> },
    { id: "chat",      name: "💬 Chat",        component: <Chat /> },
  ];

  return (
    <div className="flex h-screen bg-gray-900">
      <div className="w-48 bg-gray-800 p-4 border-r border-gray-700 flex flex-col overflow-hidden">
        <div className="shrink-0 mb-4">
          <h1 className="text-xl font-bold text-blue-400">DeskSOS</h1>
          {user && (
            <div className="mt-1 text-xs text-gray-500 truncate" title={user.email}>
              {user.name} · {user.role}
            </div>
          )}
        </div>
        <div className="space-y-1 overflow-y-auto flex-1">
          {modules.map((mod) => (
            <button type="button" key={mod.id} onClick={() => open(mod.id)} className={`w-full text-left px-3 py-2 rounded transition ${activeModule === mod.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-700"}`}>{mod.name}</button>
          ))}
        </div>
        <button
            type="button"
            onClick={logout}
            className="mt-3 w-full text-left px-3 py-2 rounded text-red-400 hover:bg-gray-700 text-sm shrink-0"
          >
            ⇠ Sign out
          </button>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {modules.filter((m) => visited.includes(m.id)).map((m) => (
            <div key={m.id} hidden={m.id !== activeModule} data-module={m.id}>
              {m.component}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppShell /> : <Login />;
}



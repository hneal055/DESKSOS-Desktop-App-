import { useState, useEffect } from "react";
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


function FixItModule() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const runAction = async (action: string, command: () => Promise<any>) => {
    setLoading(true);
    setResult("");
    try {
      const res = await command();
      setResult(`✓ ${action}: ${JSON.stringify(res)}`);
    } catch (err) {
      setResult(`✗ ${action} failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-purple-400 mb-4">🌐 Network Fixes</h2>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => runAction("Flush DNS", () => invoke("flush_dns"))} disabled={loading} className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">Flush DNS</button>
          <button type="button" onClick={() => runAction("Renew IP", () => invoke("renew_ip"))} disabled={loading} className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">Renew IP</button>
          <button type="button" onClick={() => runAction("Reset Network", () => invoke("reset_network"))} disabled={loading} className="px-4 py-3 rounded bg-red-600 hover:bg-red-700 text-white font-semibold">Reset Network</button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">🖨️ Printer Rescue</h2>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => runAction("Restart Spooler", () => invoke("restart_print_spooler"))} disabled={loading} className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">Restart Spooler</button>
          <button type="button" onClick={() => runAction("Clear Queue", () => invoke("clear_print_queue"))} disabled={loading} className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">Clear Queue</button>
        </div>
      </div>

      {result && <div className="bg-gray-700 rounded p-4 text-gray-300">{result}</div>}
    </div>
  );
}

function ProcessModule() {
  const [processes, setProcesses]: any = useState([]);
  const [loading, setLoading] = useState(false);

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
              <button type="button" onClick={async () => { try { await invoke("kill_process", { pid: p.pid }); loadProcesses(); } catch(e) {alert(e);} }} className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm">Kill</button>
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

export default function App() {
  const [activeModule, setActiveModule] = useState("dashboard");

  const modules = [
    { id: "dashboard", name: "🏠 Dashboard", component: <Dashboard /> },
    { id: "network", name: "🌐 Network", component: <NetworkDiagnostics /> },
    { id: "eventlog", name: "📋 Event Log", component: <EventLog /> },
    { id: "diskhealth", name: "💾 Disk Health", component: <DiskHealth /> },
    { id: "diskspace", name: "🗂️ Disk Space", component: <DiskSpace /> },
    { id: "errors", name: "🚨 Errors", component: <RecentErrors /> },
    { id: "software", name: "📦 Software", component: <InstalledSoftware /> },
    { id: "updates", name: "🔄 Updates", component: <WindowsUpdate /> },
    { id: "ticket", name: "🎫 Ticket", component: <TicketBuilder /> },
    { id: "fixit", name: "🔧 Fix It", component: <FixItModule /> },
    { id: "processes", name: "📊 Processes", component: <ProcessModule /> },
    { id: "powershell", name: "💻 PowerShell", component: <PowerShellModule /> },
  ];

  return (
    <div className="flex h-screen bg-gray-900">
      <div className="w-48 bg-gray-800 p-4 border-r border-gray-700">
        <h1 className="text-xl font-bold text-blue-400 mb-6">DeskSOS</h1>
        <div className="space-y-2">
          {modules.map((mod) => (
            <button type="button" key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full text-left px-3 py-2 rounded transition ${activeModule === mod.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-700"}`}>{mod.name}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {modules.find((m) => m.id === activeModule)?.component}
        </div>
      </div>
    </div>
  );
}







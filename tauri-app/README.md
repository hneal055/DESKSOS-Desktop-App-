# DeskSOS — Desktop Support Toolkit

A Windows-only Tauri v2 desktop application for IT support technicians. Runs as a single portable `.exe` with no installation required.

## Requirements

- **Windows 10** (21H1+) or **Windows 11**
- **WebView2** runtime (pre-installed on Win 10 21H1+ and all Win 11)
- Administrator privileges recommended for full functionality (service restarts, network fixes, etc.)

## Modules (17)

| # | Module | Description |
| --- | --- | --- |
| 1 | 🏠 Dashboard | System info + network health at a glance |
| 2 | 🌐 Network | ipconfig diagnostics + ping tests |
| 3 | 🔌 Adapters | All network adapters, IP config, stats, DNS/gateway |
| 4 | 📋 Event Log | System event log — Level 1–2 errors, 24h window |
| 5 | 🚨 Errors | Recent system/app errors + hardware event detection |
| 6 | 💾 Disk Health | Physical disk health via Get-PhysicalDisk |
| 7 | 🗂️ Disk Space | All drives usage, critical warnings, disk performance |
| 8 | 🧠 Memory | Top 15 memory consumers, private analysis, browser usage |
| 9 | 📊 Processes | Running processes + kill by PID |
| 10 | 📦 Software | Installed software registry scan — all/Microsoft/recent/by publisher |
| 11 | 🧰 Services | Windows services — running/all/critical/non-Microsoft tabs |
| 12 | 🔄 Updates | Installed hotfixes + pending update check |
| 13 | 🎫 Ticket | Auto-generate support ticket (copy to clipboard) |
| 14 | 🔧 Fix It | Network fixes + printer rescue commands |
| 15 | 🛠️ Net Fixes | 15 network repair tools (destructive ops require 2-click confirm) |
| 16 | 🎛️ Samples | 10 live dashboard widgets: CPU, RAM, disk, network, temp, sessions, etc. |
| 17 | 💻 PowerShell | Interactive PowerShell console |

## Architecture

```text
tauri-app/
├── src/
│   ├── App.tsx                    # Root — sidebar nav + module routing
│   └── components/modules/        # One file per module
│       ├── NetworkDiagnostics.tsx
│       ├── NetworkAdapters.tsx
│       ├── EventLog.tsx
│       ├── RecentErrors.tsx
│       ├── DiskHealth.tsx
│       ├── DiskSpace.tsx
│       ├── MemoryConsumers.tsx
│       ├── InstalledSoftware.tsx
│       ├── RunningServices.tsx
│       ├── WindowsUpdate.tsx
│       ├── TicketBuilder.tsx
│       ├── NetworkFixes.tsx
│       └── DashboardSamples.tsx
├── src-tauri/
│   └── src/lib.rs                 # Rust backend — PowerShell command runner
└── package.json
```

**Data pattern:** All modules call `invoke("run_custom_powershell", { command: "..." })` → Rust executes PowerShell → returns JSON string → parsed in React.

## Development

```bash
cd tauri-app
npm install
npm run tauri:dev
```

## Build

```bash
cd tauri-app
npm run tauri:build
```

Outputs:

- `src-tauri/target/release/desksos.exe` — portable executable
- `src-tauri/target/release/bundle/msi/DeskSOS_1.0.0_x64_en-US.msi` — MSI installer
- `src-tauri/target/release/bundle/nsis/DeskSOS_1.0.0_x64-setup.exe` — NSIS installer

## Deployment

For field use, copy `desksos.exe` to a USB drive or network share. Double-click to run — no installation needed.

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 18 + TypeScript + Tailwind CSS |
| Desktop shell | Tauri v2 |
| Bundler | Vite 6 |
| Backend | Rust + PowerShell |
| Runtime | WebView2 (Chromium) |

## IDE Setup

[VS Code](https://code.visualstudio.com/) with:

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

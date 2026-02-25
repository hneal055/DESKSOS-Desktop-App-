# DeskSOS Project Structure

## ✅ Active Components

### Production Desktop Application
**Location:** \	auri-app/\
**Type:** Native Windows desktop app (Tauri + Rust + React)
**Users:** IT support technicians and help desk analysts
**Distribution:** MSI/EXE installers

### Deployment Package
**Location:** \deployment-package/\
**Contents:**
- DeskSOS_1.0.0_x64_en-US.msi - Enterprise MSI installer
- DeskSOS_1.0.0_x64-setup.exe - Standalone EXE installer
- PowerShell deployment scripts (GPO, Manual, Verify, Uninstall)
- User documentation (USER-GUIDE.md, QUICK-START.md)

## 🗑️ Removed Components (2026-02-25)

- ❌ deployment-package/client/ - Abandoned web prototype
- ❌ renderer/ - Incomplete enterprise backend

**Reason:** DeskSOS is a desktop-only application. Web components were early prototypes superseded by the Tauri implementation.

## 🏗️ Architecture

**Desktop-Only Application (No Server Required)**

\\\
┌─────────────────────────────────────┐
│         React Frontend              │
│    (Vite + TypeScript + Tailwind)   │
├─────────────────────────────────────┤
│         Tauri Runtime               │
│         (WebView2)                  │
├─────────────────────────────────────┤
│         Rust Backend                │
│   (System APIs + PowerShell)        │
├─────────────────────────────────────┤
│       Windows Native APIs           │
└─────────────────────────────────────┘
\\\

**100% Offline** - No web server, database, or internet connection required.

## 🚀 Development Workflow

\\\powershell
# Navigate to desktop app
cd tauri-app

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build production installers
npm run tauri:build

# Output location:
# tauri-app/src-tauri/target/release/bundle/msi/
# tauri-app/src-tauri/target/release/bundle/nsis/
\\\

## 📦 Deployment

\\\powershell
cd deployment-package

# Domain-wide deployment (GPO)
.\GPO-Deployment.ps1

# Single machine
.\Manual-Deployment.ps1

# Verify installation
.\Verify-Installation.ps1

# Uninstall
.\Uninstall.ps1
\\\

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18.3 + TypeScript 5.3 |
| **Styling** | Tailwind CSS 3.4 |
| **Backend** | Rust 1.92 (Tauri 2.0) |
| **Runtime** | WebView2 (Chromium) |
| **Build** | Vite 5.0 |
| **Installers** | WiX Toolset (MSI) + NSIS (EXE) |
| **Commands** | 12 Tauri invoke commands |

## 📁 Directory Structure

\\\
DESKSOS/
├── tauri-app/                    # Main application
│   ├── src/                      # React frontend
│   │   ├── App.tsx              # Main UI (4 modules)
│   │   ├── main.tsx             # Entry point
│   │   └── styles.css           # Tailwind CSS
│   ├── src-tauri/               # Rust backend
│   │   ├── src/
│   │   │   ├── lib.rs           # 12 Tauri commands
│   │   │   └── main.rs          # Entry point
│   │   ├── Cargo.toml           # Rust dependencies
│   │   └── tauri.conf.json      # App configuration
│   ├── package.json             # Node dependencies
│   └── vite.config.ts           # Vite configuration
│
├── deployment-package/           # Distribution files
│   ├── DeskSOS_1.0.0_x64_en-US.msi
│   ├── DeskSOS_1.0.0_x64-setup.exe
│   ├── GPO-Deployment.ps1
│   ├── Manual-Deployment.ps1
│   ├── Verify-Installation.ps1
│   ├── Uninstall.ps1
│   ├── USER-GUIDE.md
│   └── QUICK-START.md
│
├── .gitignore
├── PROJECT-STRUCTURE.md          # This file
└── README.md                     # Project overview
\\\

## 🎯 Feature Modules

1. **Dashboard** - System overview and quick actions
2. **Fix It Center** - Network fixes, printer troubleshooting
3. **Process Management** - Task manager with filters
4. **PowerShell Terminal** - Integrated command-line interface

## 📝 Next Steps

1. ✅ Remove web components (completed)
2. ⬜ Update README.md with desktop-only focus
3. ⬜ Add CI/CD pipeline for automated builds
4. ⬜ Implement update checker (Tauri updater)
5. ⬜ Add telemetry/crash reporting

---

For support, see deployment-package/USER-GUIDE.md

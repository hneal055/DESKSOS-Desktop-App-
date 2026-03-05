# DeskSOS Project Structure

## Active Components

### Production Desktop Application
**Location:** `tauri-app/`
**Type:** Native Windows desktop app (Tauri + Rust + React)
**Users:** IT support technicians and help desk analysts
**Distribution:** MSI/EXE installers

### Deployment Package
**Location:** `deployment-package/`
**Contents:**
- `DeskSOS_1.0.0_x64_en-US.msi` - Enterprise MSI installer
- `DeskSOS_1.0.0_x64-setup.exe` - Standalone EXE installer
- PowerShell deployment scripts
- User documentation (USER-GUIDE.md, QUICK-START.md)

## Removed Components (2026-02-25)

- ❌ `deployment-package/client/` - Abandoned web prototype
- ❌ `renderer/server/` - Incomplete enterprise backend

**Reason:** DeskSOS is a desktop-only application. Web components were early prototypes that were superseded by the Tauri implementation.

## Technology Stack

**Desktop App:**
- Frontend: React 18.3 + TypeScript + Vite
- Backend: Rust 1.92 (Tauri 2.0)
- UI: Tailwind CSS
- Build: WiX (MSI) + NSIS (EXE)

**No server components required** - application is fully offline-capable.
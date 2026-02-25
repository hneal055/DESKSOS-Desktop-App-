# 🛠️ DeskSOS Desktop Support Toolkit - Deployment Package

**Version:** 1.0.0  
**Build Date:** 2026-02-24  
**Platform:** Windows 10/11 (x64)

---

## 📦 Package Contents

```
deployment-package/
├── DeskSOS_1.0.0_x64_en-US.msi       (3.77 MB) - Enterprise MSI Installer
├── DeskSOS_1.0.0_x64-setup.exe       (2.46 MB) - Standalone EXE Installer
├── README.md                         - This file
├── QUICK-START.md                    - Quick installation guide
├── GPO-Deployment.ps1                - Group Policy deployment script
├── Manual-Deployment.ps1             - Manual workstation deployment script
├── Uninstall.ps1                     - Uninstallation script
├── Verify-Installation.ps1           - Installation verification script
└── USER-GUIDE.md                     - End-user documentation
```

---

## ⚠️ Important: Deployment Package Location

**Actual Path to This Package:**
```powershell
C:\Projects\DESKSOS\deployment-package
```

### Common Mistakes to Avoid

❌ **WRONG - Placeholder paths from documentation:**
```powershell
cd C:\Path\To\deployment-package          # This will fail!
cd \\server\share\deployment-package      # Only if you copied it to a network share
```

✅ **CORRECT - Actual path:**
```powershell
cd C:\Projects\DESKSOS\deployment-package
```

### Quick Path Verification

**To verify you are in the correct location, run:**
```powershell
cd C:\Projects\DESKSOS\deployment-package
Get-ChildItem | Format-Table Name, Length -AutoSize
```

**Expected output should show:**
- `DeskSOS_1.0.0_x64_en-US.msi` (3.77 MB)
- `DeskSOS_1.0.0_x64-setup.exe` (2.46 MB)
- PowerShell scripts (.ps1 files)
- Documentation files (.md files)

**If you see "Cannot find path," you are using the wrong directory!**

---

## ⚡ Quick Start

### For IT Administrators (GPO Deployment)
1. Navigate to deployment package:
   ```powershell
   cd C:\Projects\DESKSOS\deployment-package
   ```
2. Copy `DeskSOS_1.0.0_x64_en-US.msi` to a network share
3. Run `GPO-Deployment.ps1` (requires Domain Admin rights):
   ```powershell
   .\GPO-Deployment.ps1
   ```
4. Link the created GPO to your IT Support OU

### For Individual Workstations
1. Navigate to deployment package:
   ```powershell
   cd C:\Projects\DESKSOS\deployment-package
   ```
2. Run deployment script as Administrator:
   ```powershell
   .\Manual-Deployment.ps1
   ```
   **Or** double-click `DeskSOS_1.0.0_x64-setup.exe`

### Verify Installation
```powershell
cd C:\Projects\DESKSOS\deployment-package
.\Verify-Installation.ps1
```

---

## 🎯 What is DeskSOS?

DeskSOS is a native Windows desktop application designed for IT support technicians to perform common troubleshooting tasks quickly and efficiently.

### Key Features

**🏠 Dashboard Module**
- Real-time system health monitoring
- Computer name, IP address, OS version
- Disk space and memory usage
- Network connectivity status (Gateway, DNS, Internet, VPN)

**🔧 Fix It Center**
- One-click network repairs (DNS flush, IP renewal, network reset)
- Printer troubleshooting (restart spooler, clear print queue)
- Performance optimization (clear temp files)

**📊 Process Manager**
- View top 10 processes by CPU/memory usage
- Kill unresponsive processes
- Real-time refresh

**💻 PowerShell Console**
- Execute custom PowerShell commands
- View command output in real-time
- Command history

---

## 🔐 Security & Requirements

### System Requirements
- **OS:** Windows 10 (1809+) or Windows 11
- **RAM:** 100 MB
- **Disk:** 10 MB
- **Network:** Optional (for network diagnostics)

### Permissions Required
- **Standard User:** Can view system information
- **Administrator:** Required for network repairs, process management, PowerShell execution

### Security Features
- No external API calls (fully offline)
- Direct PowerShell execution (no remote code)
- Native Windows APIs only
- Code-signed installer (optional - add your certificate)

---

## 📋 Deployment Options

| Method | Best For | Effort | Automation |
|--------|----------|--------|------------|
| **Group Policy (GPO)** | 50+ workstations | Low | Full |
| **Microsoft Intune** | Cloud-managed devices | Low | Full |
| **SCCM/ConfigMgr** | Enterprise (1000+ devices) | Medium | Full |
| **PowerShell Script** | 10-50 workstations | Low | Partial |
| **Manual Install** | 1-10 workstations | High | None |

See `QUICK-START.md` for detailed instructions for each method.

---

## 🚀 Installation Locations

**Application Files:**
```
C:\Program Files\DeskSOS\
├── DeskSOS.exe           - Main application
├── resources\            - UI assets
└── *.dll                 - Dependencies
```

**Registry Keys:**
```
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{GUID}
```

**Desktop Shortcut (Optional):**
```
C:\Users\Public\Desktop\DeskSOS.lnk
```

---

## 📞 Support & Documentation

- **User Guide:** `USER-GUIDE.md` (40+ pages comprehensive manual)
- **Quick Start:** `QUICK-START.md` (fast deployment guide)
- **This README:** Package overview and deployment options

### All Scripts in This Package

| Script | Purpose | Requires Admin |
|--------|---------|----------------|
| `Manual-Deployment.ps1` | Deploy to current workstation | Yes |
| `GPO-Deployment.ps1` | Create Group Policy deployment | Yes (Domain Admin) |
| `Verify-Installation.ps1` | Check if DeskSOS is installed correctly | No |
| `Uninstall.ps1` | Remove DeskSOS from workstation | Yes |

**To run any script:**
```powershell
cd C:\Projects\DESKSOS\deployment-package
.\ScriptName.ps1
```

---

## 🔄 Updating

To deploy a new version:
1. Build new installer with updated version number
2. Replace MSI/EXE files in deployment package
3. Redeploy using the same method (GPO will auto-upgrade)

---

## 📄 License

Internal use only. Not for redistribution.

---

## Pre-Deployment Validation

Run the validation script to ensure your system meets all requirements:

```powershell
.\scripts\DeskSOS-Validation.ps1
```

**Created:** February 24, 2026  
**Updated:** February 25, 2026

4. **Integrate into CI/CD** - If you have a deployment pipeline, call this script as a pre-flight check

5. **Reference in setup guides** - Link to it in `BACKEND_SETUP.md` or deployment guides

The script now provides comprehensive diagnostics for system health, network, disk space, services, memory, and DeskSOS configuration - making it valuable for troubleshooting and quality assurance.

## 🏗️ Architecture

**Desktop-Only Application (No Server Required)**

```
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
```

**100% Offline** - No web server, database, or internet connection required.

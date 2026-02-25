# 🛠️ DeskSOS Desktop Support Toolkit - Deployment Package

**Version:** 1.0.0  
**Build Date:** 2026-02-24  
**Platform:** Windows 10/11 (x64)

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

**To verify you''re in the correct location, run:**
```powershell
cd C:\Projects\DESKSOS\deployment-package
Get-ChildItem | Format-Table Name, Length -AutoSize
```

**Expected output should show:**
- `DeskSOS_1.0.0_x64_en-US.msi` (3.77 MB)
- `DeskSOS_1.0.0_x64-setup.exe` (2.46 MB)
- PowerShell scripts (.ps1 files)
- Documentation files (.md files)

**If you see "Cannot find path," you''re using the wrong directory!**

---



## ⚡ Quick Start

### For IT Administrators (GPO Deployment)
1. Copy `DeskSOS_1.0.0_x64_en-US.msi` to a network share
2. Run `GPO-Deployment.ps1` (requires Domain Admin rights)
3. Link the created GPO to your IT Support OU

### For Individual Workstations
1. Run `Manual-Deployment.ps1` as Administrator
2. Or double-click `DeskSOS_1.0.0_x64-setup.exe`

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

See `DEPLOYMENT-GUIDE.md` for detailed instructions for each method.

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

- **Deployment Guide:** `DEPLOYMENT-GUIDE.md`
- **User Guide:** `USER-GUIDE.md`
- **Quick Start:** `QUICK-START.md`
- **Troubleshooting:** See DEPLOYMENT-GUIDE.md § Troubleshooting

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

**Created:** February 24, 2026  
**Maintainer:** IT Operations Team


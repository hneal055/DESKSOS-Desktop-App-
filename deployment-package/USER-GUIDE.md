# DeskSOS User Guide

**Version 1.0.0**  
**Last Updated:** February 24, 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Administrator Guide](#administrator-guide)
4. [Analyst Features](#analyst-features)
5. [Module Reference](#module-reference)
6. [Common Tasks](#common-tasks)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is DeskSOS?

DeskSOS is a native Windows desktop application designed for IT support technicians and help desk analysts. It provides quick access to system diagnostics, network troubleshooting, process management, and PowerShell automation.

### Key Features

- **System Health Dashboard** - Real-time system information and health metrics
- **Network Diagnostics** - One-click fixes for common network issues
- **Process Management** - View and manage running processes
- **PowerShell Console** - Execute custom PowerShell commands safely
- **Offline Operation** - No internet connection required
- **No Admin Required*** - Most features work with standard user permissions

*Some features like printer management require administrator privileges

### Target Users

| Role | Use Case |
|------|----------|
| **Help Desk Analysts** | First-line support, basic troubleshooting |
| **Desktop Support Technicians** | Advanced diagnostics, system repairs |
| **IT Administrators** | Deployment, configuration, monitoring |
| **System Engineers** | PowerShell automation, scripting |

---

## Getting Started

### Launching DeskSOS

**Method 1: Desktop Shortcut**
- Double-click the **DeskSOS** icon on your desktop
- Blue wrench icon with "DeskSOS" label

**Method 2: Windows Search**
1. Press `Win` key
2. Type "DeskSOS"
3. Click **DeskSOS - Desktop Support Toolkit**

**Method 3: Direct Path**
- Navigate to: `C:\Program Files\DeskSOS\`
- Double-click: `DeskSOS.exe`

### Initial Launch

When you first open DeskSOS, you'll see:

```
┌─────────────────────────────────────────────┐
│ DeskSOS - Desktop Support Toolkit          │
├─────────────────────────────────────────────┤
│ ┃ Dashboard     │  System Health Dashboard  │
│ ┃ Fix It        │  • Computer Name          │
│ ┃ Processes     │  • OS Version             │
│ ┃ PowerShell    │  • CPU/RAM Usage          │
│                 │  • Network Status         │
└─────────────────────────────────────────────┘
```

**Navigation:**
- Click sidebar icons (🏠 Dashboard, 🔧 Fix It, 📊 Processes, 💻 PowerShell)
- Each module loads instantly (no page refresh)

### System Requirements

- **OS:** Windows 10 (1809+) or Windows 11
- **RAM:** 100 MB minimum
- **Disk:** 10 MB
- **Permissions:** Standard user (some features require admin)
- **Network:** Offline capable

---

## Administrator Guide

### Installation Management

#### Silent Installation (GPO/Script)
```powershell
# Command for automated deployment
msiexec /i "DeskSOS_1.0.0_x64_en-US.msi" /quiet /norestart /l*v "C:\Logs\DeskSOS_Install.log"
```

**Parameters:**
- `/quiet` - No user interaction
- `/norestart` - Prevents automatic reboot
- `/l*v` - Verbose logging to specified path

#### Custom Installation Path
```powershell
# Install to custom directory
msiexec /i "DeskSOS_1.0.0_x64_en-US.msi" INSTALLDIR="D:\Tools\DeskSOS" /quiet
```

#### Registry Validation
Check installation success:
```powershell
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
  Where-Object { $_.DisplayName -like "*DeskSOS*" }
```

Expected output:
```
DisplayName     : DeskSOS
DisplayVersion  : 1.0.0
Publisher       : DeskSOS Team
InstallLocation : C:\Program Files\DeskSOS\
UninstallString : MsiExec.exe /X{GUID}
```

### Deployment Verification

**Step 1: Check File Presence**
```powershell
Test-Path "C:\Program Files\DeskSOS\DeskSOS.exe"
```
Should return: `True`

**Step 2: Verify Version**
```powershell
(Get-Item "C:\Program Files\DeskSOS\DeskSOS.exe").VersionInfo.ProductVersion
```
Should return: `1.0.0`

**Step 3: Test Launch**
```powershell
Start-Process "C:\Program Files\DeskSOS\DeskSOS.exe"
```
Application window should appear within 5 seconds

**Step 4: Run Verification Script**
```powershell
.\Verify-Installation.ps1
```

Expected output:
```
=========================================
  DeskSOS Installation Verification
=========================================

Check                Status
-----                ------
Application Files    PASS
Registry Entry       PASS
Desktop Shortcut     PASS
Process Running      ACTIVE
Admin Permissions    YES

System Information:
  Computer: TECH-WS-01
  Username: jsmith
  OS: Microsoft Windows 11 Enterprise
  Build: 22631
```

### Group Policy Deployment

**Prerequisites:**
- Domain Admin rights
- RSAT tools installed
- Network share accessible to all computers

**Step 1: Prepare Network Share**
```powershell
# Create MSI repository
New-Item -ItemType Directory -Path "\\DC01\Software$\DeskSOS" -Force
Copy-Item "DeskSOS_1.0.0_x64_en-US.msi" "\\DC01\Software$\DeskSOS\"

# Set permissions
icacls "\\DC01\Software$\DeskSOS" /grant "Domain Computers:(RX)"
```

**Step 2: Create GPO**
```powershell
.\GPO-Deployment.ps1 -NetworkSharePath "\\DC01\Software$\DeskSOS" -OUPath "OU=IT Support,DC=contoso,DC=com"
```

**Step 3: Configure Software Installation (Manual)**
1. Open: `gpmc.msc`
2. Find GPO: **Deploy DeskSOS Toolkit**
3. Right-click → **Edit**
4. Navigate: Computer Configuration → Policies → Software Settings → Software Installation
5. Right-click → **New** → **Package**
6. Browse to: `\\DC01\Software$\DeskSOS\DeskSOS_1.0.0_x64_en-US.msi`
7. Deployment method: **Assigned**
8. Click **OK**

**Step 4: Test on Pilot Machine**
```powershell
# On target workstation
gpupdate /force
Restart-Computer
```

After reboot, verify:
```powershell
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
  Where-Object { $_.DisplayName -like "*DeskSOS*" }
```

**Step 5: Monitor Deployment**
```powershell
# Check GPO application status
gpresult /r /scope:computer | Select-String "DeskSOS"
```

### Uninstallation

**Silent Uninstall:**
```powershell
# Query product code
$productCode = (Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
                Where-Object { $_.DisplayName -like "*DeskSOS*" }).PSChildName

# Uninstall
msiexec /x $productCode /quiet /norestart /l*v "C:\Logs\DeskSOS_Uninstall.log"
```

**Script-Based Uninstall:**
```powershell
.\Uninstall.ps1
```

**Verification:**
```powershell
# Confirm removal
Test-Path "C:\Program Files\DeskSOS\DeskSOS.exe"  # Should return False
```

### Monitoring Usage

**Check Running Instances:**
```powershell
Get-Process -Name "desksos" -ComputerName (Get-Content computers.txt) | 
  Select-Object PSComputerName, Id, StartTime, @{N='Memory (MB)';E={[math]::Round($_.WS/1MB,2)}}
```

**Event Log Monitoring:**
```powershell
# DeskSOS writes to Windows Application log
Get-WinEvent -LogName Application -MaxEvents 50 | 
  Where-Object { $_.ProviderName -like "*DeskSOS*" }
```

---

## Analyst Features

### User Interface Overview

#### Sidebar Navigation

```
╔══════════════╗
║  🏠 Dashboard ║  ← System health overview
║  🔧 Fix It    ║  ← Quick tools repairs
║  📊 Processes ║  ← Process management
║  💻 PowerShell║  ← Command execution
╚══════════════╝
```

**Navigation Tips:**
- Click any icon to switch modules
- Current module is highlighted in blue
- No loading screens - instant switching

#### Dashboard Module (🏠)

**What You See:**

```
╔════════════════════════════════════════════╗
║  SYSTEM INFORMATION                        ║
╠════════════════════════════════════════════╣
║  Computer Name:    TECH-WS-01              ║
║  OS Version:       Windows 11 Pro          ║
║  OS Build:         22631.3296              ║
║  CPU:              Intel Core i7-12700K    ║
║  Total RAM:        16.00 GB                ║
║  Available RAM:    8.24 GB                 ║
║  RAM Usage:        48.5%                   ║
║  Uptime:           2 days, 14 hours        ║
╚════════════════════════════════════════════╝

╔════════════════════════════════════════════╗
║  NETWORK HEALTH                            ║
╠════════════════════════════════════════════╣
║  ✅ Gateway:       192.168.1.1 (OK)        ║
║  ✅ DNS:           Online                  ║
║  ✅ Internet:      Connected               ║
║  ⚠️  VPN:          Disconnected            ║
╚════════════════════════════════════════════╝
```

**How to Use:**

1. **Quick System Check**
   - Open DeskSOS → Dashboard loads automatically
   - Scan the "System Information" card for vital stats
   - Use for ticket documentation (copy/paste)

2. **Identify Issues**
   - Look for ⚠️ warnings in Network Health
   - Red ❌ icons indicate failures
   - Green ✅ means component is healthy

3. **Copy System Info**
   - Select text with mouse
   - Right-click → Copy
   - Paste into ticket system

**Common Scenarios:**

| Indicator | Meaning | Action |
|-----------|---------|--------|
| RAM Usage > 90% | Memory pressure | Go to Processes → Kill high-memory apps |
| Gateway ❌ | Network adapter issue | Go to Fix It → Renew IP |
| DNS ❌ | DNS resolution failure | Go to Fix It → Flush DNS |
| Internet ❌ | No external connectivity | Check firewall/proxy settings |

#### Fix It Module (🔧)

**Available Tools:**

```
╔════════════════════════════════════════════╗
║  NETWORK TOOLS                             ║
╠════════════════════════════════════════════╣
║  [Flush DNS Cache]          Clean DNS      ║
║  [Renew IP Address]         DHCP renewal   ║
║  [Reset Network Stack]      Full reset     ║
╚════════════════════════════════════════════╝

╔════════════════════════════════════════════╗
║  PRINTER TOOLS                             ║
╠════════════════════════════════════════════╣
║  [Restart Print Spooler]    Fix stuck jobs ║
║  [Clear Print Queue]        Delete all jobs║
╚════════════════════════════════════════════╝

╔════════════════════════════════════════════╗
║  SYSTEM MAINTENANCE                        ║
╠════════════════════════════════════════════╣
║  [Clear Temp Files]         Free disk space║
╚════════════════════════════════════════════╝
```

**Tool Reference:**

**1. Flush DNS Cache**
- **When to Use:** Website not loading, DNS errors, network changes
- **What It Does:** Clears local DNS cache, forces fresh lookups
- **PowerShell Equivalent:** `ipconfig /flushdns`
- **Admin Required:** No
- **Runtime:** 1-2 seconds

**Example:**
```
User: "I can't access the company website"
You: Click [Flush DNS Cache] → Wait for "Success" → Retry
```

**2. Renew IP Address**
- **When to Use:** No network access, DHCP issues, 169.254.x.x address
- **What It Does:** Releases old IP, requests new one from DHCP server
- **PowerShell Equivalent:** `ipconfig /release && ipconfig /renew`
- **Admin Required:** Yes (prompts for elevation)
- **Runtime:** 3-5 seconds

**Example:**
```
User: "I have a 169.254.1.50 address"
You: Click [Renew IP Address] → UAC prompt → Allow → Wait for new IP
Dashboard → Verify gateway is green ✅
```

**3. Reset Network Stack**
- **When to Use:** Multiple network issues, corrupt network settings
- **What It Does:** Resets Winsock, TCP/IP stack, IP config
- **PowerShell Equivalent:** `netsh winsock reset; netsh int ip reset`
- **Admin Required:** Yes
- **Runtime:** 10-15 seconds
- **Reboot:** Recommended after execution

**Warning:** This is a destructive action. Document current settings first.

**Example:**
```
User: "Nothing is working - no internet, no file shares, nothing"
You: 
  1. Dashboard → Screenshot network settings
  2. Fix It → [Reset Network Stack]
  3. Wait for "Success"
  4. Restart computer
  5. Dashboard → Verify all green ✅
```

**4. Restart Print Spooler**
- **When to Use:** Print jobs stuck, printer offline, documents won't print
- **What It Does:** Stops/starts Print Spooler service
- **PowerShell Equivalent:** `Restart-Service -Name Spooler -Force`
- **Admin Required:** Yes
- **Runtime:** 2-4 seconds

**Example:**
```
User: "My document has been 'printing' for an hour"
You: 
  1. Fix It → [Restart Print Spooler]
  2. UAC prompt → Allow
  3. Wait for "Print Spooler restarted successfully"
  4. User sends test print
```

**5. Clear Print Queue**
- **When to Use:** Multiple stuck print jobs, old documents cluttering queue
- **What It Does:** Deletes all files in `C:\Windows\System32\spool\PRINTERS\`
- **PowerShell Equivalent:** `Stop-Service Spooler; Remove-Item C:\Windows\System32\spool\PRINTERS\* -Force; Start-Service Spooler`
- **Admin Required:** Yes
- **Runtime:** 3-5 seconds

**Example:**
```
User: "I have 47 print jobs stuck from yesterday"
You: 
  1. Fix It → [Clear Print Queue]
  2. UAC prompt → Allow
  3. Verify: "Cleared X print jobs successfully"
  4. User opens Devices and Printers → Queue should be empty
```

**6. Clear Temp Files**
- **When to Use:** Low disk space, performance issues, general maintenance
- **What It Does:** Removes files from `%TEMP%` and `C:\Windows\Temp`
- **PowerShell Equivalent:** `Remove-Item $env:TEMP\* -Recurse -Force -ErrorAction SilentlyContinue`
- **Admin Required:** No (clears user temp only)
- **Runtime:** 5-30 seconds (depends on files)

**Example:**
```
User: "My C: drive is almost full"
You: 
  1. Dashboard → Note available disk space
  2. Fix It → [Clear Temp Files]
  3. Wait for "Cleared X MB of temporary files"
  4. Dashboard → Refresh → Verify space freed
```

**Output Interpretation:**

```
✅ Success Messages:
"DNS cache flushed successfully"
"IP address renewed successfully"
"Network stack reset complete - restart recommended"
"Print Spooler restarted successfully"
"Cleared 15 print jobs successfully"
"Cleared 2.4 GB of temporary files"

⚠️ Warning Messages:
"Admin privileges required - please allow UAC prompt"
"Operation completed but requires restart"

❌ Error Messages:
"Failed to flush DNS: Access denied"
"Print Spooler service not found"
"No temporary files to clear"
```

#### Processes Module (📊)

**Interface Layout:**

```
╔═══════════════════════════════════════════════════════════════╗
║  TOP PROCESSES BY RESOURCE USAGE                              ║
╠═══════════════════════════════════════════════════════════════╣
║  Process Name          PID      CPU %    Memory (MB)   [Kill] ║
║  ─────────────────────────────────────────────────────────────║
║  chrome.exe           5432      45.2%       1,847.2    [Kill] ║
║  teams.exe            8764      12.8%         892.5    [Kill] ║
║  outlook.exe          3298       8.1%         445.3    [Kill] ║
║  explorer.exe         2148       2.4%         186.8    [Kill] ║
║  desksos.exe          9912       0.8%          45.2    [Kill] ║
║  svchost.exe          1024       0.3%          28.7    [Kill] ║
║                                                                ║
║  [Refresh Process List]                                       ║
╚═══════════════════════════════════════════════════════════════╝
```

**How to Use:**

**1. Identify Resource Hogs**
- Processes sorted by CPU/Memory usage (highest first)
- Look for unusually high numbers:
  - CPU > 50% sustained = Investigation needed
  - Memory > 2 GB for single app = Potential leak
  - Multiple instances of same process = Possible issue

**2. Kill Unresponsive Process**
```
Step 1: Identify problem process
  Example: "outlook.exe" using 95% CPU for 10 minutes

Step 2: Click [Kill] button next to process
  Confirmation dialog: "Kill outlook.exe (PID 3298)?"

Step 3: Confirm action
  Click "Yes" → Process terminates immediately

Step 4: Verify termination
  Click [Refresh Process List]
  Confirm process no longer appears
```

**Safety Guidelines:**

| Process Type | Safe to Kill? | Notes |
|--------------|---------------|-------|
| **Browser tabs** (chrome.exe, msedge.exe) | ✅ Yes | User may lose unsaved work |
| **Teams, Slack, Zoom** | ✅ Yes | Can restart after |
| **Office apps** | ⚠️ Caution | Warn about unsaved documents |
| **explorer.exe** | ⚠️ Caution | Desktop will disappear (can restart from Task Manager) |
| **System processes** (svchost, services, lsass) | ❌ No | Can crash system |
| **csrss.exe, smss.exe** | ❌ Never | Critical system processes |

**Common Scenarios:**

**Scenario 1: Frozen Application**
```
User: "Excel froze and won't close"
You:
  1. Processes → Find "EXCEL.EXE"
  2. Note CPU/Memory (likely 0% CPU, high memory)
  3. Click [Kill] next to EXCEL.EXE
  4. Confirm termination
  5. Tell user: "Excel closed - reopen and recover document"
```

**Scenario 2: Computer Running Slow**
```
User: "Everything is really slow"
You:
  1. Dashboard → Check RAM usage (e.g., 95%)
  2. Processes → Identify top 3 memory consumers
  3. Example: chrome.exe (2.4 GB), teams.exe (1.8 GB)
  4. Ask user: "Can I close Chrome/Teams temporarily?"
  5. If yes: Kill processes
  6. Dashboard → Verify RAM usage dropped (e.g., to 65%)
```

**Scenario 3: Multiple Instances**
```
User: "I see 15 Chrome processes in Task Manager"
You:
  1. Processes → Count chrome.exe instances
  2. Each Chrome tab = separate process (this is normal)
  3. If total memory reasonable (< 3 GB), explain: "This is normal Chrome behavior"
  4. If excessive: Ask user to close unused tabs, or [Kill] specific Chrome processes
```

**Refresh Frequency:**
- Process list refreshes every 5 seconds automatically
- Click [Refresh Process List] for immediate update
- CPU/Memory values update in real-time

#### PowerShell Module (💻)

**Interface Layout:**

```
╔═══════════════════════════════════════════════════════════════╗
║  POWERSHELL CONSOLE                                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Command Input:                                               ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ Get-Service | Where Status -eq 'Stopped'               │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║                                          [Execute Command]   ║
║  ─────────────────────────────────────────────────────────────║
║  Output:                                                      ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ Status   Name               DisplayName                 │ ║
║  │ ------   ----               -----------                 │ ║
║  │ Stopped  ALG                Application Layer Gateway   │ ║
║  │ Stopped  AppIDSvc           Application Identity        │ ║
║  │ Stopped  AppMgmt            Application Management      │ ║
║  │                                                          │ ║
║  └─────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════╝
```

**Security Notes:**

⚠️ **Important:**
- Commands execute with **current user permissions**
- If not admin, admin-required commands will fail
- No command history saved (for security)
- Output limited to 10,000 characters

**Common Commands:**

**System Information:**
```powershell
# Get detailed computer info
Get-ComputerInfo | Select-Object CsName, WindowsVersion, OsArchitecture

# Check last boot time
Get-CimInstance Win32_OperatingSystem | Select-Object LastBootUpTime

# List installed hotfixes
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10
```

**Network Diagnostics:**
```powershell
# Test connectivity to server
Test-NetConnection -ComputerName fileserver.contoso.com -Port 445

# Get IP configuration
Get-NetIPAddress | Where-Object AddressFamily -eq 'IPv4'

# Check DNS resolution
Resolve-DnsName www.microsoft.com

# List network adapters
Get-NetAdapter | Select-Object Name, Status, LinkSpeed
```

**User Management:**
```powershell
# Get current user info
whoami /all

# List local administrators
Get-LocalGroupMember -Group "Administrators"

# Check user's groups
whoami /groups
```

**Disk Space:**
```powershell
# Check disk space
Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free, @{N='Size(GB)';E={[math]::Round($_.Used/1GB+$_.Free/1GB,2)}}

# Find large files
Get-ChildItem C:\Users\$env:USERNAME -Recurse -File -ErrorAction SilentlyContinue | 
  Sort-Object Length -Descending | 
  Select-Object -First 20 FullName, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}}
```

**Service Management:**
```powershell
# Check service status
Get-Service -Name Spooler

# List running services
Get-Service | Where-Object Status -eq 'Running' | Sort-Object Name

# Get service dependencies
Get-Service -Name Spooler -RequiredServices
```

**Event Logs:**
```powershell
# Recent errors
Get-EventLog -LogName System -EntryType Error -Newest 10

# Application crashes
Get-EventLog -LogName Application -Source "Application Error" -Newest 5

# Recent warnings
Get-WinEvent -FilterHashtable @{LogName='System'; Level=3} -MaxEvents 10
```

**Process Information:**
```powershell
# Find process by name
Get-Process -Name chrome | Select-Object Id, CPU, @{N='Memory(MB)';E={[math]::Round($_.WS/1MB,2)}}

# Get process start time
Get-Process | Select-Object Name, StartTime | Sort-Object StartTime -Descending

# Find processes using port
Get-NetTCPConnection -LocalPort 80 | Select-Object OwningProcess
```

**Printer Diagnostics:**
```powershell
# List installed printers
Get-Printer | Select-Object Name, DriverName, PortName

# Check print jobs
Get-PrintJob -PrinterName "Canon Printer"

# Test printer connection
Test-Connection -ComputerName printserver.contoso.com -Count 2
```

**Best Practices:**

1. **Test Before Modifying**
   ```powershell
   # Use -WhatIf parameter
   Remove-Item C:\Test\* -WhatIf  # Shows what would happen, doesn't execute
   ```

2. **Limit Output**
   ```powershell
   # Use Select-Object -First
   Get-ChildItem C:\Windows | Select-Object -First 20
   ```

3. **Handle Errors**
   ```powershell
   # Use -ErrorAction SilentlyContinue for expected errors
   Get-ChildItem C:\Users -Recurse -ErrorAction SilentlyContinue
   ```

4. **Format Output**
   ```powershell
   # Use Format-Table for readability
   Get-Service | Format-Table -AutoSize
   ```

**Command Execution:**

```
Step 1: Type command in input box
Step 2: Click [Execute Command]
Step 3: Wait for output (appears below)
Step 4: Review results

Timing:
  - Simple commands: < 1 second
  - Network tests: 2-5 seconds
  - File searches: 10-60 seconds
```

**Error Messages:**

```powershell
# No admin rights
"Access to the path 'C:\Windows\System32' is denied."
→ Right-click DeskSOS.exe → Run as Administrator

# Invalid syntax
"The term 'Get-Serv' is not recognized as the name of a cmdlet..."
→ Check command spelling

# Network timeout
"Test-NetConnection : Cannot resolve hostname"
→ Check DNS, network connectivity
```

---

## Module Reference

### Quick Reference Card

| Module | Icon | Primary Use | Admin Required | Avg Runtime |
|--------|------|-------------|----------------|-------------|
| Dashboard | 🏠 | System overview | No | < 1 sec |
| Fix It | 🔧 | Repair tools | Some commands | 1-15 sec |
| Processes | 📊 | Process management | No* | < 1 sec |
| PowerShell | 💻 | Custom commands | Depends on command | Varies |

*Killing processes requires their access level

### Network Troubleshooting Flowchart

```
User reports network issue
         ↓
   Dashboard → Network Health
         ↓
   Gateway ❌?
      ↓ Yes → Fix It → Renew IP Address
         ↓
   DNS ❌?
      ↓ Yes → Fix It → Flush DNS Cache
         ↓
   Internet ❌?
      ↓ Yes → Fix It → Reset Network Stack
         ↓
   All green ✅?
      ↓ Yes → Issue resolved
      ↓ No → Escalate to Network team
```

### Printer Troubleshooting Flowchart

```
User can't print
      ↓
Dashboard → Is computer online?
      ↓ Yes
Fix It → Restart Print Spooler
      ↓
Wait 5 seconds
      ↓
User tries to print → Works?
      ↓ No
Fix It → Clear Print Queue
      ↓
PowerShell → Test-Connection printserver
      ↓
Reachable? → No → Network issue
      ↓ Yes
Check printer status on server
```

---

## Common Tasks

### Task 1: Document System Info for Ticket

**Scenario:** User calls with issue, you need computer details

**Steps:**
1. Launch DeskSOS
2. Dashboard already open (default view)
3. Select text from "System Information" card:
   - Computer Name
   - OS Version
   - RAM Usage
   - Uptime
4. Right-click → Copy (or Ctrl+C)
5. Paste into ticket system

**Example Output:**
```
Computer Name: SALES-WS-42
OS Version: Microsoft Windows 11 Pro (23H2)
OS Build: 22631.3296
CPU: Intel Core i5-8500
Total RAM: 16.00 GB
Available RAM: 6.42 GB (40.1% used)
Uptime: 12 days, 3 hours, 24 minutes
```

**Time to Complete:** 30 seconds

---

### Task 2: Fix "Can't Access Network Share"

**Scenario:** User can't open `\\fileserver\shared`

**Steps:**
1. Dashboard → Check Network Health
   - Gateway ✅ → OK
   - DNS ❌ → **This is the issue**

2. Fix It → Click [Flush DNS Cache]
   - Output: "DNS cache flushed successfully"

3. Ask user to retry: `\\fileserver\shared`
   - If works → Done
   - If doesn't work → Proceed to step 4

4. Fix It → Click [Renew IP Address]
   - UAC prompt → Click "Yes"
   - Output: "IP address renewed successfully"

5. Dashboard → Verify all green ✅

6. User retries share access → Should work now

**Time to Complete:** 2-3 minutes

---

### Task 3: Computer Running Slow Investigation

**Scenario:** User complains computer is "really slow"

**Steps:**

**Phase 1: Gather Data**
1. Dashboard → Check metrics:
   ```
   RAM Usage: 94.2% ⚠️  ← High!
   CPU: (not directly shown, but check via Processes)
   ```

**Phase 2: Identify Culprit**
2. Processes → Review top consumers:
   ```
   chrome.exe    5432   12.3%   2,847 MB  ← Using 2.8 GB RAM!
   teams.exe     8764    8.1%   1,256 MB  ← Using 1.2 GB RAM!
   outlook.exe   3298    2.4%     892 MB
   ```

**Phase 3: Take Action**
3. Ask user: "Can I close Chrome and Teams temporarily?"
   - User says yes → Click [Kill] for chrome.exe
   - Click [Kill] for teams.exe

**Phase 4: Verify Improvement**
4. Dashboard → Check new RAM usage:
   ```
   RAM Usage: 48.3% ✅  ← Much better!
   ```

5. Tell user: "You can reopen Chrome and Teams now"
   - Suggest: "Try using fewer browser tabs"

**Time to Complete:** 3-5 minutes

---

### Task 4: Printer Won't Print

**Scenario:** User sent 5 documents to printer, nothing printed

**Steps:**

1. Ask: "Did you get any error message?"
   - "No, it just says 'printing' forever"

2. Fix It → Click [Restart Print Spooler]
   - UAC prompt → Click "Yes"
   - Output: "Print Spooler restarted successfully"

3. Wait 10 seconds

4. Ask user: "Try printing now"
   - If works → Done
   - If doesn't work → Proceed to step 5

5. Fix It → Click [Clear Print Queue]
   - UAC prompt → Click "Yes"
   - Output: "Cleared 5 print jobs successfully"

6. Ask user: "Re-send your print job"

7. Still not working? → Check physical printer:
   - PowerShell → Type: `Test-Connection -ComputerName PRINTER01 -Count 2`
   - If fails → Printer offline/network issue

**Time to Complete:** 3-5 minutes

---

### Task 5: Free Up Disk Space

**Scenario:** User gets "Low Disk Space" warning

**Steps:**

1. Dashboard → (Note: Disk space not shown in current version)
   - Workaround: PowerShell → Type:
   ```powershell
   Get-PSDrive C | Select-Object @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}}
   ```
   - Output shows: `Free(GB): 2.43` ← Very low!

2. Fix It → Click [Clear Temp Files]
   - Wait 15-30 seconds (doesn't require admin)
   - Output: "Cleared 3.8 GB of temporary files"

3. Verify: PowerShell → Re-run disk check:
   ```powershell
   Get-PSDrive C | Select-Object @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}}
   ```
   - Output shows: `Free(GB): 6.23` ← Better!

4. If still low:
   - PowerShell → Find large files:
   ```powershell
   Get-ChildItem C:\Users\$env:USERNAME\Downloads -File | 
     Sort-Object Length -Descending | 
     Select-Object -First 10 Name, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}}
   ```
   - Show user large files in Downloads folder
   - Ask: "Can we delete these old downloads?"

**Time to Complete:** 5-10 minutes

---

### Task 6: Get Event Log Errors

**Scenario:** Computer crashed yesterday, need to find cause

**Steps:**

1. PowerShell → Get recent system errors:
   ```powershell
   Get-EventLog -LogName System -EntryType Error -After (Get-Date).AddDays(-1) | 
     Select-Object TimeGenerated, Source, Message | 
     Format-Table -AutoSize
   ```

2. Review output for critical errors:
   ```
   TimeGenerated        Source         Message
   -------------        ------         -------
   2/23/2026 2:45 PM   disk           The device, \Device\Harddisk0\DR0, has a bad block
   2/23/2026 2:47 PM   volmgr         Crash dump initialization failed!
   ```

3. Copy relevant errors → Paste in ticket

4. If specific application:
   ```powershell
   Get-EventLog -LogName Application -Source "Application Error" -Newest 10 | 
     Select-Object TimeGenerated, Message
   ```

5. Document findings:
   - "System log shows disk errors at 2:45 PM"
   - "Recommend: Run disk check `chkdsk /f`"

**Time to Complete:** 5 minutes

---

### Task 7: Check If Computer is Domain-Joined

**Scenario:** User can't access network resources

**Steps:**

1. PowerShell → Check domain status:
   ```powershell
   Get-ComputerInfo | Select-Object CsName, CsDomain, CsDomainRole
   ```

2. Interpret output:
   ```
   CsName   : TECH-WS-42
   CsDomain : CONTOSO
   CsDomainRole : MemberWorkstation

   ✅ Domain-joined = CsDomain shows domain name
   ❌ Not domain-joined = CsDomain shows "WORKGROUP"
   ```

3. If not domain-joined:
   - Escalate to domain admin team
   - Ticket: "Computer needs to be joined to CONTOSO domain"

**Time to Complete:** 1 minute

---

### Task 8: Verify Software Installation

**Scenario:** User says "I don't think Office is installed"

**Steps:**

1. PowerShell → List installed Microsoft Office products:
   ```powershell
   Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
     Where-Object { $_.DisplayName -like "*Office*" -or $_.DisplayName -like "*Excel*" } | 
     Select-Object DisplayName, DisplayVersion
   ```

2. Output shows:
   ```
   DisplayName                        DisplayVersion
   -----------                        --------------
   Microsoft Office Professional Plus 16.0.16827.20166
   ```
   - ✅ Office is installed (version 16.0)

3. If user says "But I don't see Excel on my desktop":
   - PowerShell → Find Excel executable:
   ```powershell
   Get-ChildItem "C:\Program Files\Microsoft Office" -Recurse -Filter "EXCEL.EXE" -ErrorAction SilentlyContinue | 
     Select-Object FullName
   ```
   - Create desktop shortcut manually, or
   - Tell user: Windows Search → Type "Excel"

**Time to Complete:** 2-3 minutes

---

## Best Practices

### For Help Desk Analysts

1. **Always Start with Dashboard**
   - Establishes baseline system health
   - Catches obvious issues immediately
   - Provides documentation for tickets

2. **Use Fix It for Standard Issues**
   - Network problems → Flush DNS, Renew IP
   - Printer problems → Restart Spooler, Clear Queue
   - Performance → Clear Temp Files
   - Don't jump to PowerShell for common tasks

3. **Document Everything**
   - Copy system info into tickets
   - Screenshot network health before/after fixes
   - Note which tools you used and results

4. **Know Your Escalation Path**
   | Issue Type | Escalate To |
   |------------|-------------|
   | Hardware failure | Desktop Support Team |
   | Network infrastructure | Network Operations |
   | Domain/AD issues | Systems Administration |
   | Permissions | Security Team |

5. **PowerShell Safety**
   - Only use commands you understand
   - Use `-WhatIf` parameter when testing
   - Never run commands from untrusted sources
   - Don't delete system files

### For Desktop Support Technicians

1. **Process Management Strategy**
   - Check memory usage before killing processes
   - Warn users about unsaved work
   - Know safe vs. unsafe processes to kill
   - Use Task Manager for system processes (not DeskSOS)

2. **Network Troubleshooting Order**
   ```
   1. Dashboard → Identify failed component
   2. Flush DNS (safest, fastest)
   3. Renew IP (requires admin, safe)
   4. Reset Network Stack (last resort, requires reboot)
   ```

3. **PowerShell Efficiency**
   - Create personal library of useful commands
   - Use tab completion for cmdlet names
   - Pipe to `Format-Table -AutoSize` for readability
   - Save complex one-liners in Notepad for reuse

4. **Performance Investigation**
   ```
   Step 1: Dashboard → RAM usage
   Step 2: Processes → Identify top 5
   Step 3: PowerShell → Get-Process | Sort-Object WorkingSet -Descending | Select -First 10
   Step 4: Analyze trends (not snapshots)
   ```

### For IT Administrators

1. **Deployment Best Practices**
   - Test on pilot group (10-20 users) before org-wide
   - Use GPO for 50+ workstations
   - Use Intune for cloud-managed devices
   - Manual install acceptable for < 10 workstations

2. **Post-Deployment Verification**
   ```powershell
   # Query all workstations
   $computers = Get-ADComputer -Filter {OperatingSystem -like "*Windows*"} -Property Name | 
                Select-Object -ExpandProperty Name

   foreach ($computer in $computers) {
     $installed = Invoke-Command -ComputerName $computer -ScriptBlock {
       Test-Path "C:\Program Files\DeskSOS\DeskSOS.exe"
     }
     [PSCustomObject]@{
       Computer = $computer
       Installed = $installed
     }
   }
   ```

3. **User Training**
   - 15-minute live demo showing 4 modules
   - Print quick reference card (1-page)
   - Record 5-minute video walkthrough
   - Share this user guide via SharePoint/Confluence

4. **Usage Monitoring**
   ```powershell
   # Check who's running DeskSOS
   Get-Process -Name "desksos" -IncludeUserName -ComputerName (Get-Content computers.txt) | 
     Select-Object PSComputerName, UserName, StartTime
   ```

5. **Version Control**
   - Tag installers: `DeskSOS_1.0.0_x64_en-US.msi`
   - Maintain changelog for each release
   - Test upgrades on pilot before org-wide

---

## Troubleshooting

### Application Won't Launch

**Symptom:** Double-click DeskSOS, nothing happens

**Diagnosis:**

1. Check if process already running:
   ```powershell
   Get-Process -Name "desksos"
   ```
   - If found → Close existing window, try again
   - If not found → Proceed to step 2

2. Verify installation:
   ```powershell
   Test-Path "C:\Program Files\DeskSOS\DeskSOS.exe"
   ```
   - If False → Reinstall application
   - If True → Proceed to step 3

3. Check Event Viewer:
   ```
   eventvwr.msc → Windows Logs → Application
   Look for Source: "DeskSOS" or "Application Error"
   ```

4. Try running as Administrator:
   ```
   Right-click DeskSOS.exe → Run as Administrator
   ```

**Solutions:**
- Corrupted install → Uninstall + Reinstall
- Antivirus blocking → Add exception for DeskSOS.exe
- Missing .NET dependencies → Install WebView2 Runtime

---

### "Admin Privileges Required" Error

**Symptom:** Fix It tools show "Admin privileges required"

**Cause:** Certain operations need elevated permissions:
- Renew IP Address
- Reset Network Stack
- Restart Print Spooler
- Clear Print Queue

**Solution:**

**Option 1: Run DeskSOS as Admin (Recommended)**
```
1. Close DeskSOS
2. Right-click desktop shortcut
3. Click "Run as Administrator"
4. UAC prompt → Click "Yes"
5. DeskSOS now has admin rights
```

**Option 2: Per-Command Elevation**
```
1. Keep DeskSOS running as standard user
2. When you click admin-required tool
3. UAC prompt appears → Click "Yes"
4. That single command runs elevated
```

**Best Practice:** If you're doing troubleshooting session with multiple admin tasks, use Option 1.

---

### PowerShell Commands Return Errors

**Symptom:** Commands fail with "Access Denied" or "Not recognized"

**Common Errors:**

**Error 1:** `Get-ADUser : The term 'Get-ADUser' is not recognized`
- **Cause:** Active Directory module not installed
- **Solution:** This is expected. DeskSOS doesn't include AD commands yet.
- **Workaround:** Use `net user` command instead:
  ```powershell
  net user USERNAME /domain
  ```

**Error 2:** `Access to the path is denied`
- **Cause:** Insufficient permissions
- **Solution:** Run DeskSOS as Administrator (see previous section)

**Error 3:** `Cannot bind argument to parameter 'ComputerName' because it is null`
- **Cause:** Variable not defined or syntax error
- **Solution:** Check command syntax, use tab completion

**Error 4:** Command times out (no output after 30 seconds)
- **Cause:** Command taking too long (large file search, network timeout)
- **Solution:** Click [Refresh] or close/reopen DeskSOS

---

### Network Health Shows All Red ❌

**Symptom:** Dashboard → Network Health → All indicators red

**Causes and Solutions:**

**Scenario 1: Computer Offline**
- You: `ipconfig /all` in PowerShell
- Output shows: `169.254.x.x` address (APIPA)
- Solution: Fix It → Renew IP Address

**Scenario 2: Network Adapter Disabled**
- You: `Get-NetAdapter` in PowerShell
- Output shows: `Status : Disabled`
- Solution: Enable adapter via Control Panel OR:
  ```powershell
  Enable-NetAdapter -Name "Ethernet" -Confirm:$false
  ```

**Scenario 3: Cable Unplugged**
- Physical layer issue
- Check: Ethernet cable plugged in
- Check: Link lights on network port
- Solution: Plug in cable, or switch to WiFi

**Scenario 4: Firewall Blocking**
- Symptom: Gateway OK, but DNS/Internet fail
- Solution: Check Windows Firewall:
  ```powershell
  Get-NetFirewallProfile | Select-Object Name, Enabled
  ```
- If overly restrictive → Escalate to Security team

---

### Network Health Shows Unknown

**Symptom:** Dashboard → Network Health shows `Unknown` or blank values for Gateway, DNS, or Internet

**Causes and Solutions:**

1. **ICMP blocked by firewall**
   - DeskSOS uses `Test-Connection` for checks
   - Verify manually in PowerShell:
   ```powershell
   Test-Connection -ComputerName 1.1.1.1 -Count 1
   ```
   - If blocked, allow ICMP echo in local firewall or use DNS tests

2. **No default gateway**
   - Verify route table:
   ```powershell
   Get-NetRoute -DestinationPrefix "0.0.0.0/0"
   ```
   - If empty, renew IP or fix adapter settings

3. **Restricted network cmdlets**
   - Run DeskSOS as Administrator and retry

**Note:** VPN status shows `Disconnected` when no active VPN is detected.

---

### Process List Shows Empty

**Symptom:** Processes module → No processes displayed

**Causes:**

1. **Permission Issue**
   - Solution: Run DeskSOS as Administrator

2. **WMI Corruption**
   - Diagnosis: PowerShell → `Get-Process` (if this also fails, WMI issue)
   - Solution:
   ```powershell
   # Repair WMI
   winmgmt /verifyrepository
   winmgmt /salvagerepository
   ```

3. **Application Crash**
   - Solution: Restart DeskSOS

---

### Dashboard Info Not Updating

**Symptom:** System info shows old data (e.g., uptime wrong)

**Solution:** Click module icon again to refresh
- Click Dashboard icon (🏠)
- Data reloads automatically
- Network Health rechecks connections

**Note:** Dashboard data is snapshot-based, not real-time streaming.

---

### Slow Performance When Using DeskSOS

**Symptom:** DeskSOS itself is sluggish or freezing

**Causes and Solutions:**

1. **Computer Under Heavy Load**
   - Check: Processes → Review system resources
   - If RAM > 95% or CPU > 90% → Close other applications first

2. **PowerShell Command Still Running**
   - Long-running command blocks interface
   - Solution: Wait for completion, or close/reopen DeskSOS

3. **DeskSOS Memory Leak** (Rare)
   - Check: Processes → Find desksos.exe memory usage
   - If > 500 MB → Restart DeskSOS

4. **Antivirus Scanning**
   - Some AV products scan each PowerShell command execution
   - Solution: Add DeskSOS.exe to AV exclusions

---

## Keyboard Shortcuts

| Shortcut | Action | Module |
|----------|--------|--------|
| `Alt+1` | Dashboard | All |
| `Alt+2` | Fix It | All |
| `Alt+3` | Processes | All |
| `Alt+4` | PowerShell | All |
| `Ctrl+C` | Copy selected text | All |
| `Ctrl+A` | Select all (in output) | PowerShell |
| `Ctrl+L` | Clear PowerShell output | PowerShell |
| `F5` | Refresh process list | Processes |
| `Esc` | Close confirmation dialog | All |

---

## Glossary

**Terms Used in DeskSOS:**

- **DNS (Domain Name System):** Translates website names to IP addresses. When broken, websites won't load.
- **DHCP (Dynamic Host Configuration Protocol):** Automatically assigns IP addresses. Renew IP gets new address from DHCP server.
- **IP Address:** Unique identifier for computer on network (e.g., 192.168.1.100).
- **Gateway:** Router that connects local network to internet/other networks.
- **Print Spooler:** Windows service that manages print jobs. Common source of printer issues.
- **Process:** Running program or service. Each has PID (Process ID).
- **RAM (Random Access Memory):** Fast temporary storage. High usage = slow computer.
- **UAC (User Account Control):** Windows security prompt asking for admin permission.
- **Winsock:** Windows networking component. Reset fixes corrupt network settings.

---

## Support and Feedback

### Getting Help

**Internal IT Support:**
- Email: it-support@contoso.com
- Phone: x5500
- Ticket Portal: https://helpdesk.contoso.com

**DeskSOS Issues:**
- Bug reports: Submit ticket with tag "DeskSOS"
- Feature requests: Email it-tools@contoso.com
- Training: Request via IT Training Portal

### Feedback

Help us improve DeskSOS:
1. What features do you use most?
2. What issues do you encounter?
3. What additional tools would help?

Send feedback to: desksos-feedback@contoso.com

---

## Appendix: Quick Command Reference

### Pre-Built PowerShell Commands

Copy these into PowerShell module:

**System Health Check:**
```powershell
Get-ComputerInfo | Select-Object CsName, WindowsVersion, OsArchitecture, CsProcessors, CsTotalPhysicalMemory, OsLastBootUpTime | Format-List
```

**Network Full Diagnostic:**
```powershell
Test-NetConnection -ComputerName google.com -InformationLevel Detailed
```

**Disk Space All Drives:**
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}}, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}}, @{N='Total(GB)';E={[math]::Round(($_.Used+$_.Free)/1GB,2)}} | Format-Table -AutoSize
```

**Recent System Errors:**
```powershell
Get-EventLog -LogName System -EntryType Error -Newest 10 | Select-Object TimeGenerated, Source, Message | Format-Table -Wrap
```

**Installed Software:**
```powershell
Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | Select-Object DisplayName, DisplayVersion, Publisher | Sort-Object DisplayName | Format-Table -AutoSize
```

**Network Adapters:**
```powershell
Get-NetAdapter | Select-Object Name, Status, LinkSpeed, MacAddress | Format-Table -AutoSize
```

**Running Services:**
```powershell
Get-Service | Where-Object Status -eq 'Running' | Select-Object Name, DisplayName, StartType | Sort-Object Name | Format-Table -AutoSize
```

**Top 10 Memory Consumers:**
```powershell
Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Name, Id, @{N='Memory(MB)';E={[math]::Round($_.WorkingSet/1MB,2)}} | Format-Table -AutoSize
```

---

**End of User Guide**

*DeskSOS v1.0.0 - Desktop Support Toolkit*  
*© 2026 DeskSOS Team - Internal Use Only*



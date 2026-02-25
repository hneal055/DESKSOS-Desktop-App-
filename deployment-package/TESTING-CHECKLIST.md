# 🧪 DeskSOS End-User Testing Checklist
**Version:** 1.0.0  
**Test Date:** ___________  
**Tester:** ___________  
**Workstation:** ___________

---

## ✅ Pre-Test Setup

### 1. Installation Verification
- [ ] DeskSOS appears in Start Menu
- [ ] Desktop shortcut exists (if created)
- [ ] Application launches successfully
- [ ] Window opens with correct title: "DeskSOS - Desktop Support Toolkit"
- [ ] No error messages during launch

**Command to verify installation:**
```powershell
Test-Path "C:\Program Files\DeskSOS\DeskSOS.exe"
Get-Process -Name desksos -ErrorAction SilentlyContinue
```

---

## 🏠 Dashboard Module Testing

### System Information Display
- [ ] **Computer Name** displays correctly
- [ ] **IP Address** shows current local IP
- [ ] **Operating System** displays Windows version
- [ ] **Disk Space** shows used/total (C: drive)
- [ ] **Memory Usage** shows current RAM usage

### Network Connectivity Status
Test all 4 indicators show correct status:
- [ ] **Gateway** - Green checkmark if reachable
- [ ] **DNS** - Green checkmark if 8.8.8.8 responds
- [ ] **Internet** - Green checkmark if google.com reachable
- [ ] **VPN** - Shows correct VPN connection status

**How to test:**
1. Open Dashboard tab
2. Verify all system info displays
3. Check network status indicators
4. Disconnect network → Refresh → Verify red X indicators
5. Reconnect network → Refresh → Verify green checkmarks return

---

## 🔧 Fix It Center Testing

### Test Each Repair Tool

#### 1. Flush DNS Cache
- [ ] Button clickable
- [ ] Shows "Working..." or loading state
- [ ] Completes with success message
- [ ] DNS cache actually cleared

**Verify DNS was flushed:**
```powershell
# Before clicking: ipconfig /displaydns shows entries
# After clicking: ipconfig /displaydns should show empty
ipconfig /displaydns
```

#### 2. Renew IP Address
- [ ] Button clickable
- [ ] Shows progress indicator
- [ ] Completes with success message
- [ ] IP address renewed (may change if DHCP)

**Verify IP renewal:**
```powershell
ipconfig /all  # Check "Lease Obtained" timestamp
```

#### 3. Reset Network Stack
- [ ] Button clickable
- [ ] Warning message appears (if configured)
- [ ] Executes netsh commands
- [ ] Success message displayed
- [ ] Prompt to restart (if required)

**Note:** May require restart to fully apply changes

#### 4. Restart Print Spooler
- [ ] Button clickable (requires Admin)
- [ ] UAC prompt appears if running as standard user
- [ ] Spooler service restarts
- [ ] Success message displayed

**Verify spooler restarted:**
```powershell
Get-Service -Name Spooler | Select-Object Status, DisplayName
# Status should show "Running"
```

#### 5. Clear Print Queue
- [ ] Button clickable (requires Admin)
- [ ] UAC prompt if needed
- [ ] Print jobs cleared
- [ ] Success confirmation

**Verify print queue cleared:**
```powershell
Get-Printer | Get-PrintJob  # Should return empty or no stuck jobs
```

#### 6. Clear Temp Files
- [ ] Button clickable
- [ ] Shows progress or file count
- [ ] Temporary files deleted
- [ ] Success message with space freed

**Verify temp files cleared:**
```powershell
$tempSize = (Get-ChildItem $env:TEMP -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "Temp folder size: $([math]::Round($tempSize, 2)) MB"
```

---

## 📊 Processes Module Testing

### Process List Display
- [ ] Shows top 10 processes by CPU/Memory
- [ ] Process names display correctly
- [ ] CPU percentages shown
- [ ] Memory MB values shown
- [ ] List updates when refresh clicked

### Kill Process Functionality
- [ ] Can select a process from list
- [ ] Kill button becomes enabled when process selected
- [ ] Confirmation dialog appears (if configured)
- [ ] Process terminates successfully
- [ ] Success message displayed
- [ ] Process list updates after kill

**Safe test process:**
```powershell
# Start a test process you can safely kill
Start-Process notepad
# Then use DeskSOS to kill it
```

---

## 💻 PowerShell Console Testing

### Command Execution
Test with these safe commands:

#### Test 1: Basic Command
- [ ] Enter: `Get-Date`
- [ ] Click Execute
- [ ] Output displays current date/time
- [ ] No errors

#### Test 2: System Info Command
- [ ] Enter: `Get-ComputerInfo | Select-Object CsName, WindowsVersion`
- [ ] Output shows computer name and Windows version
- [ ] Formatting is readable

#### Test 3: Network Command
- [ ] Enter: `Test-Connection google.com -Count 2`
- [ ] Output shows ping results
- [ ] Response times displayed

#### Test 4: Error Handling
- [ ] Enter invalid command: `Get-FakeCommand`
- [ ] Error message displayed (not crash)
- [ ] Can execute another command after error

#### Test 5: Multi-line Output
- [ ] Enter: `Get-Process | Select-Object -First 5`
- [ ] Table output displays correctly
- [ ] All columns visible

### Command History
- [ ] Previous commands saved
- [ ] Can recall with up/down arrows (if feature exists)
- [ ] History persists during session

---

## 🔒 Security & Permissions Testing

### Standard User Testing
**Run as non-admin user:**
- [ ] Dashboard displays correctly (read-only)
- [ ] Network status checks work
- [ ] Flush DNS works (doesn't require admin)
- [ ] Renew IP requires UAC prompt
- [ ] Network reset requires UAC prompt
- [ ] Restart spooler requires UAC prompt
- [ ] PowerShell commands execute with user permissions

### Administrator Testing
**Run as admin or after UAC elevation:**
- [ ] All Fix It tools execute without UAC prompts
- [ ] Can kill system processes
- [ ] PowerShell runs elevated commands
- [ ] No permission errors

---

## 🚨 Error Handling & Stability

### Stress Testing
- [ ] Click buttons rapidly - no crashes
- [ ] Switch between modules quickly - UI responsive
- [ ] Execute multiple commands in sequence - no hangs
- [ ] Close and reopen - settings persist (if applicable)

### Network Disconnection Testing
- [ ] Disconnect network cable/WiFi
- [ ] Dashboard shows red indicators
- [ ] Fix It tools show appropriate errors (not crash)
- [ ] Reconnect network
- [ ] Dashboard updates to green indicators

### Edge Cases
- [ ] No printer installed - Clear Queue shows message
- [ ] No temp files - Clear Temp shows 0 files
- [ ] No processes to kill - Kill button disabled
- [ ] Empty PowerShell command - Shows error or does nothing

---

## 📝 Performance Metrics

### Startup Performance
- [ ] Application launches in < 5 seconds
- [ ] Dashboard loads system info immediately
- [ ] No lag when switching tabs

### Resource Usage
```powershell
# Check DeskSOS resource usage
Get-Process desksos | Select-Object Name, CPU, 
  @{N="Memory(MB)";E={[math]::Round($_.WS/1MB,2)}}
```

**Acceptable thresholds:**
- [ ] Memory usage < 150 MB
- [ ] CPU < 5% when idle
- [ ] No memory leaks after 30 minutes

### Response Times
- [ ] Fix It tools complete in < 10 seconds
- [ ] Process list loads in < 2 seconds
- [ ] PowerShell commands execute immediately

---

## ✅ Final Validation Checklist

### Core Functionality
- [ ] All 4 modules accessible
- [ ] All 12 Rust commands execute successfully
- [ ] No crashes or freezes during testing
- [ ] Error messages are user-friendly
- [ ] UI remains responsive

### User Experience
- [ ] Interface is intuitive
- [ ] Icons/buttons clearly labeled
- [ ] Success/error messages clear
- [ ] No confusing terminology
- [ ] Help or instructions accessible (if exists)

### Production Readiness
- [ ] No debug console appears
- [ ] No placeholder text visible
- [ ] Version number correct (1.0.0)
- [ ] Company/app name displays correctly
- [ ] Can be used by non-technical users

---

## 🐛 Issues Found

**Record any bugs or issues:**

| Issue # | Module | Description | Severity | Steps to Reproduce |
|---------|--------|-------------|----------|-------------------|
| 1 |  |  | Critical/High/Medium/Low |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |

---

## 📊 Test Results Summary

**Total Tests:** _____  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

**Overall Status:** ☐ PASS  ☐ PASS with Issues  ☐ FAIL

**Recommendation:**  
☐ Approved for deployment  
☐ Needs fixes before deployment  
☐ Major rework required  

---

## 📋 Automated Test Script

Run this PowerShell script for quick verification:

```powershell
# Quick DeskSOS Function Test
Write-Host "`n=== DeskSOS Quick Test ===" -ForegroundColor Cyan

# 1. Check if installed
$appPath = "C:\Program Files\DeskSOS\DeskSOS.exe"
if (Test-Path $appPath) {
    Write-Host "✅ DeskSOS installed at: $appPath" -ForegroundColor Green
} else {
    Write-Host "❌ DeskSOS NOT found" -ForegroundColor Red
    exit
}

# 2. Check if running
$proc = Get-Process -Name desksos -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "✅ DeskSOS is running (PID: $($proc.Id))" -ForegroundColor Green
    Write-Host "   Memory: $([math]::Round($proc.WS/1MB, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  DeskSOS not currently running" -ForegroundColor Yellow
    Write-Host "   Launch it to continue testing" -ForegroundColor Yellow
}

# 3. Test network connectivity (what Dashboard shows)
Write-Host "`n=== Network Status ===" -ForegroundColor Cyan
$gateway = (Get-NetRoute -DestinationPrefix "0.0.0.0/0").NextHop
if (Test-Connection -ComputerName $gateway -Count 1 -Quiet) {
    Write-Host "✅ Gateway reachable: $gateway" -ForegroundColor Green
} else {
    Write-Host "❌ Gateway unreachable" -ForegroundColor Red
}

if (Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet) {
    Write-Host "✅ DNS server reachable (8.8.8.8)" -ForegroundColor Green
} else {
    Write-Host "❌ DNS server unreachable" -ForegroundColor Red
}

if (Test-Connection -ComputerName google.com -Count 1 -Quiet) {
    Write-Host "✅ Internet reachable (google.com)" -ForegroundColor Green
} else {
    Write-Host "❌ Internet unreachable" -ForegroundColor Red
}

# 4. Check services (for Fix It tools)
$spooler = Get-Service -Name Spooler
Write-Host "`n=== Services Status ===" -ForegroundColor Cyan
Write-Host "Print Spooler: $($spooler.Status)" -ForegroundColor $(if ($spooler.Status -eq 'Running') {'Green'} else {'Red'})

# 5. System info (what Dashboard displays)
Write-Host "`n=== System Information ===" -ForegroundColor Cyan
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
Write-Host "Computer: $($cs.Name)" -ForegroundColor Cyan
Write-Host "OS: $($os.Caption)" -ForegroundColor Cyan
Write-Host "Memory: $([math]::Round($os.TotalVisibleMemorySize/1MB, 2)) GB" -ForegroundColor Cyan

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Now perform manual tests in the DeskSOS application`n" -ForegroundColor Yellow
```

**Save this script as:** `C:\Projects\DESKSOS\deployment-package\Test-DeskSOS.ps1`

---

**Testing Notes:**
- Perform tests on a non-production workstation first
- Test both as standard user and administrator
- Document all issues with screenshots
- Verify fixes don''t break existing functionality
- Re-test after any code changes

**Estimated Testing Time:** 30-45 minutes for complete validation

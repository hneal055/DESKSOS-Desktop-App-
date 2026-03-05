# 🚀 DeskSOS Quick Start Guide

## For IT Administrators

### Option 1: Install on Single Workstation (5 minutes, MSI or EXE)

1. **Copy deployment package** to target workstation
2. **Choose installer option:**
   - **MSI (recommended for managed deployments):** `DeskSOS_1.0.0_x64_en-US.msi`
   - **EXE (recommended for simple manual install):** `DeskSOS_1.0.0_x64-setup.exe`
3. **If using MSI, right-click PowerShell** → Run as Administrator
4. **Run (use the actual folder where you copied the package):**
   ```powershell
   cd "$env:USERPROFILE\Downloads\deployment-package"
   .\Manual-Deployment.ps1
   ```
5. **If using EXE,** double-click `DeskSOS_1.0.0_x64-setup.exe`
6. **Done!** Launch from desktop shortcut

---

### Option 2: Deploy via GPO (30 minutes setup)

1. **Copy MSI to network share:**
   ```powershell
   Copy-Item "DeskSOS_1.0.0_x64_en-US.msi" "\\DC01\NETLOGON\DeskSOS\"
   ```

2. **Run GPO deployment script:**
   ```powershell
   .\GPO-Deployment.ps1 -NetworkSharePath "\\DC01\NETLOGON\DeskSOS" -OUPath "OU=IT Support,DC=contoso,DC=com"
   ```

3. **Complete manual GPO configuration** (see script output)

4. **Test on one workstation:**
   ```powershell
   gpupdate /force
   ```

5. **Verify:**: Check `C:\Program Files\DeskSOS\`

6. **Roll out** to all workstations (effective on next reboot)

---

### Option 3: Microsoft Intune (Cloud Deployment)

1. **Login** to Microsoft Endpoint Manager admin center

2. **Apps** → Windows → **Add** → Line-of-business app

3. **Upload:** `DeskSOS_1.0.0_x64_en-US.msi`

4. **Configure:**
   - Name: DeskSOS Desktop Support Toolkit
   - Publisher: IT Operations
   - Install command: `msiexec /i DeskSOS_1.0.0_x64_en-US.msi /quiet`

5. **Assign** to Azure AD group: "IT Support Staff"

6. **Deploy** as Required

---

## For End Users

### Launching DeskSOS

1. **Double-click** desktop shortcut: `DeskSOS`
2. Or **Search** Windows: Type "DeskSOS"
3. Or **Run:** `C:\Program Files\DeskSOS\DeskSOS.exe`

### Using the Toolkit

**Dashboard (🏠)** - System overview
- View computer name, IP, OS version
- Check network health (Gateway/DNS/Internet/VPN)

**Fix It Center (🔧)** - One-click repairs
- **Network Issues:** Flush DNS, Renew IP, Reset Network
- **Printer Problems:** Restart Spooler, Clear Queue
- **Performance:** Clear Temp Files

**Process Manager (📊)** - Task management
- View top 10 processes
- Kill unresponsive apps
- Monitor CPU/Memory usage

**PowerShell Console (💻)** - Advanced commands
- Run custom PowerShell scripts
- View real-time output
- Requires Administrator rights

---

## Common Scenarios

### Scenario 1: "User can''t access network shares"
1. Open DeskSOS → **Dashboard**
2. Check Network Health status
3. If DNS failing → **Fix It Center** → **Flush DNS**
4. If IP issue → **Fix It Center** → **Renew IP Address**

### Scenario 2: "Printer won''t print"
1. Open DeskSOS → **Fix It Center**
2. Click **Restart Print Spooler**
3. Click **Clear Print Queue**
4. Test print

### Scenario 3: "Computer is slow"
1. Open DeskSOS → **Process Manager**
2. Identify high CPU/Memory processes
3. Kill unresponsive processes
4. **Fix It Center** → **Clear Temp Files**

### Scenario 4: "Need system information for ticket"
1. Open DeskSOS → **Dashboard**
2. Copy system information
3. Paste into ticket

---

## Troubleshooting Installation

**Problem: "Must be run as Administrator"**
- Right-click PowerShell → Run as Administrator
- Or run: `Start-Process powershell -Verb RunAs`

**Problem: "Installer not found"**
- Ensure MSI/EXE is in same folder as script
- Check file name matches: `DeskSOS_1.0.0_x64_en-US.msi`

**Problem: "Installation failed"**
- Check log: `C:\Users\<username>\AppData\Local\Temp\DeskSOS_Install.log`
- Verify Windows version: Windows 10 1809+ or Windows 11
- Ensure disk space: 10 MB free

**Problem: "Application won''t launch"**
- Check: `C:\Program Files\DeskSOS\DeskSOS.exe` exists
- Run as Administrator for full functionality
- Check Windows Event Viewer: Application logs

---

## Next Steps

📖 **Full Documentation:** See `DEPLOYMENT-GUIDE.md` for advanced deployment options

👤 **User Training:** See `USER-GUIDE.md` for detailed feature documentation

🔍 **Verification:** Run `Verify-Installation.ps1` to check deployment status

---

**Need Help?** Contact IT Operations Team

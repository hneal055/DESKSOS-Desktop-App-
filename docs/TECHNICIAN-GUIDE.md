# DeskSOS Desktop: Technician Quick-Start Guide

This guide is for helpdesk technicians who use the installed DeskSOS app on
their Windows PC. It covers what each page does, how to raise a ticket and how
to run the common fixes. Server setup is in [OPERATIONS.md](OPERATIONS.md).

---

## 1. What DeskSOS is

DeskSOS is a desktop support toolkit. It checks the PC it is running on
(network, disks, event logs, updates, services), runs one-click fixes, and
builds a support ticket with the diagnostics attached. Tickets, chat and remote
sessions go through the DeskSOS server.

**What you need:**

- The DeskSOS app installed on your PC (Start menu → **DeskSOS**).
- A DeskSOS account (email and password) from your admin.
- To be on the office network. The installed app talks to the server at
  `https://FORD-DC01:5443`.

Everything DeskSOS checks or fixes is **the PC the app is running on**. To
diagnose a user's PC, run DeskSOS on that PC.

---

## 2. Signing in

1. Open **DeskSOS** from the Start menu.
2. Enter your **Email** and **Password**, then click **Sign in**.
3. Your name and role appear under **DeskSOS** at the top of the sidebar.

To finish, click **⇠ Sign out** at the bottom of the sidebar.

Good to know:

- You need to sign in **every time you open the app**. DeskSOS doesn't remember
  your sign-in after you close it.
- A sign-in lasts up to 7 days. When it expires, DeskSOS returns to the
  sign-in screen with "Your session has expired. Please sign in again."
- Only your admin can create accounts or reset passwords. The app has no
  "forgot password" option.

**If sign-in fails:**

| Message or symptom | What to do |
|---|---|
| "Invalid credentials" | Wrong email or password. Check them and try again. If you've forgotten your password, ask your admin to reset it. |
| "Too many auth attempts, please try again later." | Too many attempts in a short time. Wait 15 minutes, then try again. |
| "Couldn't reach the DeskSOS server…" | Check you're on the office network (not guest Wi-Fi, not at home without VPN). If you are, tell your admin; the server may be down. |
| Login works for colleagues but never on your PC | Your PC may not trust the DeskSOS certificate. Your admin needs to install it on your PC (one-time setup). |

---

## 3. A tour of the sidebar

Click a sidebar item to open that page. Pages you've opened keep their
contents when you switch away and back, including a half-written ticket,
until you sign out or close DeskSOS.

"Server" means the page needs a connection to the DeskSOS server. Pages
without it work offline, on the local PC only.

| Sidebar label | What it's for | Server | Admin rights |
|---|---|---|---|
| 🏠 **Dashboard** | Health cards for **Network**, **Disk Space**, **Event Log (24h)** and **Windows Update**; **Machine Info**; the **Ticket Queue** (Open, In Progress, Resolved). Runs its checks when opened; **🔄 Refresh** runs them again. | Ticket Queue only | No |
| 🌐 **Network** | **🔍 Run Network Diagnostics**: shows IP configuration (hostname, IPv4/IPv6, gateway, DNS servers, MAC, DHCP) and tests Gateway Ping, DNS Resolution and Internet Connectivity. | No | No |
| 🔌 **Adapters** | Lists network adapters with status, speed, IP addresses, gateway, DNS and data sent/received. Click an adapter to expand it. **Show All Adapters** includes disconnected ones. An **APIPA** tag on an address means the PC got no address from DHCP. | No | No |
| 📋 **Event Log** | Critical and Error events from the System and Application logs. Choose a time range (**1h**, **6h**, **24h**, **7d**) and a log (**All**, **System**, **Application**), then click **🔍 Load Events**. Click an event to read the full message. | No | No |
| 🚨 **Errors** | Recent errors in four tabs: **System Errors**, **App Errors**, **Critical 24h**, **Hardware** (last 30 days). | No | No |
| 💾 **Disk Health** | **Overall** health of physical drives, **Volume Space** per drive, and **Physical Drives** (model, type, serial, status). | No | No |
| 🗂️ **Disk Space** | **All Drives** with **LOW** (75%+ used) and **CRITICAL** (90%+ used) tags, **Disk Performance**, and **🔍 Scan System Drive** to list the **Top 10 Largest Folders** (takes 1–3 minutes). | No | No |
| 🧠 **Memory** | **System Memory** (total, used, free), **Top Processes by Memory**, and **Browser Memory Usage**. | No | No |
| 📊 **Processes** | Top 10 processes by CPU, with a **Kill** button for each (see the caution in section 5). | No | Sometimes |
| 📦 **Software** | Installed programs. Tabs: **All Software** (with search), **Microsoft Products**, **Recently Installed** (**Last 30 days** / **Last 90 days**), **By Publisher**. | No | No |
| 🧰 **Services** | Windows services. Tabs: **Running**, **All Services** (with search), **Critical** (key services and whether they're running), **Non-Microsoft** (review for anything unfamiliar). View only. | No | No |
| 🔄 **Updates** | **Windows Update Service** status, **Reboot Status**, **📥 Pending Updates** (click **🔍 Check for Pending Updates**; up to 30 seconds), and **📋 Recently Installed** updates. View only; it doesn't install updates. | No | No |
| 🎫 **Ticket** | The **Ticket Builder**: describe the issue, gather diagnostics, submit or copy the ticket. See section 4. | Submit only | No |
| 🔧 **Fix It** | Quick buttons: **Flush DNS**, **Renew IP**, **Reset Network**, **Restart Spooler**, **Clear Queue**. See section 5. | No | Yes, for most |
| 🛠️ **Net Fixes** | 15 network repair and information tools, with a confirm step for disruptive ones. See section 5. | No | Yes, for most repairs |
| 🎛️ **Samples** | A sample page of 10 system widgets (**▶ Load All Widgets**). It's a preview of dashboard layouts, not a working tool. You can ignore it. | No | No |
| 💻 **PowerShell** | A console that runs a PowerShell command on this PC (**Execute**). For experienced technicians only. | No | Depends on the command |
| 📡 **Remote** | Remote screen viewing between DeskSOS users. See section 6. | Yes | No |
| 💬 **Chat** | Team chat channels. See section 6. | Yes | No |

---

## 4. Creating a ticket

Open **🎫 Ticket** in the sidebar. Do this on the PC that has the problem,
because the diagnostics come from that PC.

### Step 1: Describe the Issue

1. **Issue Description** (required to submit): what's wrong, who's affected,
   since when. The first 100 characters become the ticket title, after the
   computer name, e.g. `[WS-042] Outlook not syncing since 9am`.
2. **Steps Already Tried** (optional): what you've done so far, e.g.
   "Restarted machine, flushed DNS, checked cables".
3. **Priority**: click **Low**, **Medium**, **High** or **Critical**. The
   default is **Medium**.

### Step 2: Gather Diagnostics

Click **🔍 Gather Diagnostics** and wait a few seconds. A summary appears:
**Machine**, **User**, **IP**, **Network** (Online/Offline), **Errors (24h)**
and **Last Update**. If you fix something and want fresh data, click
**🔄 Re-gather Diagnostics**.

The ticket automatically includes:

| Section | Contents |
|---|---|
| Machine information | Computer name, logged-in Windows user, domain, IP address, Windows version, uptime |
| Network status | Gateway ping, ping to 8.8.8.8, ping to 1.1.1.1 |
| Disk space | Used and free space on every drive |
| Recent errors | Up to 5 critical/error events from the last 24 hours |
| Windows Update | The most recent installed update and its date |

Your issue description, steps tried and priority are added too. The logged-in
Windows user is recorded as the ticket's requester.

### Step 3: Submit or Copy

This section appears after diagnostics are gathered, with a preview of the
full report.

- **📤 Submit to DeskSOS** sends the ticket to the server. It's greyed out
  until you've filled in **Issue Description**. On success you'll see
  **"✓ Ticket T-12345678 created successfully."** Note the ticket number.
- **📋 Copy Ticket** copies the whole report to the clipboard (the button
  shows **✅ Copied!**). Paste it into an email or another system, or keep it
  if submitting fails.

After a successful submit the button reads **✅ Submitted!** and can't be
clicked again, so the same ticket can't be sent twice. For the next ticket,
click **🆕 Start a new ticket** next to the success message. It clears the
description, steps and priority, and keeps the diagnostics; click
**🔄 Re-gather Diagnostics** if they need refreshing.

If submitting fails (red message), use **📋 Copy Ticket** so you don't lose
the report, then check section 7.

### Choosing a priority

New tickets are forwarded to the **DeskSOS Enterprise** operations dashboard.
**A Critical ticket raises an audible alarm for the operations team.** Use
Critical only when the business has stopped.

| Priority | Use it when | Examples |
|---|---|---|
| **Low** | Minor issue, workaround exists, no deadline | Cosmetic glitch, request for optional software, monitor flickers now and then |
| **Medium** (default) | One person's work is slowed but not stopped | Outlook slow to sync, a single printer jam, password reset during the working day |
| **High** | One person or a small team can't work, or a deadline is at risk | User can't log in, can't reach a shared drive, laptop won't connect to the network |
| **Critical** | Business-stopping: many users or a key system down, or a security incident | Whole office offline, server or line-of-business app down, suspected malware spreading |

If in doubt, choose **High** and call the operations team rather than raising
a Critical alarm.

---

## 5. Common fixes

### Running DeskSOS as administrator

If DeskSOS isn't running as administrator, the **Fix It** and **Processes**
pages show a yellow warning at the top, because those actions will fail with
"Access is denied" or "requires elevation". To run as administrator: close
DeskSOS, open the Start menu, right-click **DeskSOS**, choose **Run as
administrator**, and sign in again.

**Renew IP**, **Reset Network** and **Clear Queue** are known to need
administrator rights. Most other actions that change system settings
(resets, service restarts) need them too.

In the tables below, **Yes** means the action needs admin rights. **Likely**
means Windows normally requires them, but it hasn't been tested in DeskSOS.
If an action fails with "Access is denied", that's the reason.

### Fix It

The page has two sections, **🌐 Quick Network Fixes** and **🖨️ Printer
Rescue**. **Flush DNS** runs at once. The others ask first: the first click
shows what will happen, then click **⚠️ Confirm …** or **Cancel**. The
result appears below the buttons (✓ for success, ✗ with the error for
failure).

| Button | What it does | Admin | Caution |
|---|---|---|---|
| **Flush DNS** | Clears the DNS cache so names are looked up fresh | Usually not | Safe |
| **Renew IP** | Releases and renews the PC's IP address | **Yes** | Network drops for a few seconds |
| **Reset Network** | Resets Winsock and the TCP/IP stack | **Yes** | **Disruptive.** Network settings return to defaults; **reboot required** afterwards |
| **Restart Spooler** | Restarts the Windows print spooler | Likely | Printing pauses briefly |
| **Clear Queue** | Stops the spooler, **deletes every waiting print job** on this PC, restarts it | **Yes** | All queued jobs are lost; warn the user first |

### Net Fixes

Each card has a **▶ Run** button. Cards with an orange **Write** tag change
settings: the first click arms them, then click **⚠️ Confirm Run** (or
**Cancel**). Cards with a red **Reboot** tag need a restart to take effect.
Output appears on the card; **✕** clears it.

| Card | What it does | Write / Reboot | Admin |
|---|---|---|---|
| **DNS Flush** | Clears the DNS cache | | Usually not |
| **IP Release** | Releases the IP address. **The PC has no network until you run IP Renew** | Write | Likely |
| **IP Renew** | Gets a new IP address from DHCP | | Likely |
| **Winsock Reset** | Resets Windows Sockets | Write, Reboot | Yes |
| **TCP/IP Stack Reset** | Resets TCP/IP to defaults | Write, Reboot | Yes |
| **ARP Cache Clear** | Clears IP-to-MAC mappings | | Yes |
| **NetBIOS Reset** | Reloads the NetBIOS name cache | | Likely |
| **DHCP Client Restart** | Restarts the DHCP Client service | Write | Yes |
| **Network Adapter Reset** | Turns every connected adapter off and on | Write | Yes |
| **Route Table** | Shows the routing table (read only) | | No |
| **Firewall Status** | Shows firewall on/off for Domain, Private, Public | | No |
| **Proxy Settings Reset** | Resets the system (WinHTTP) proxy to direct | | Yes |
| **Network Profile** | Shows network profiles (e.g. Public/Private) and connectivity | | No |
| **DNS Server Info** | Shows DNS servers per adapter | | No |
| **Complete Stack Reset** | Winsock + TCP/IP reset together | Write, Reboot | Yes |

**Cautions:**

- **Network Adapter Reset**, **IP Release** and the resets cut the network.
  If you're helping someone remotely, you'll lose the connection.
- After any **Reboot** fix, restart the PC before testing again.
- A suggested order for "no internet": **Run Network Diagnostics** (Network
  page) → **DNS Flush** → **IP Renew** → **Network Adapter Reset** → resets
  only as a last resort.

### Processes and PowerShell

- **Processes → Kill** asks first ("End *name*? Unsaved work in it is lost."),
  then **⚠️ Confirm Kill** or **Cancel**. Make sure it's the right one. System
  processes and other users' processes need admin rights, and killing them can
  crash Windows.
- **PowerShell → Execute** runs whatever you type, with your rights on this
  PC. Only run commands you understand.

---

## 6. Chat and Remote Session

### 💬 Chat

- Channels are listed on the left; the first one opens automatically. Click a
  channel to switch.
- Type in the box and click **Send**, or press **Enter**. **Shift+Enter**
  starts a new line.
- Your messages show as **You**. Messages from others appear live.
- Channels are set up on the server; you can't create them in the app.

### 📡 Remote (Remote Sessions)

Remote lets one DeskSOS user **view** another DeskSOS user's screen. It's
view only: you can't control the other PC's mouse or keyboard.

Both people must be signed in to DeskSOS, on the **Remote** page, and
connected:

1. Check **Display Name** (this is what others see). Leave **Server URL** as
   it is.
2. Click **Connect**. The status changes to **● Connected**.
3. **To view someone's screen:** find them under **👥 Online Users** and click
   **Remote In**. You'll see **⏳ Requesting Session** until they accept
   (**Cancel** to give up). Once connected, their screen appears under
   **📺 Viewing:** with an **End Session** button.
4. **When someone asks to view yours:** a **Remote Access Request** box
   appears. Click **Accept** or **Decline**. If you accept, Windows asks which
   screen or window to share. While sharing, **Screen sharing active** is
   shown; click **Stop Sharing** to end it.
5. Click **Disconnect** when done.

Online Users lists accounts, not PCs. Two people signed in with the same
account won't see each other.

---

## 7. Troubleshooting

| Symptom | What to do |
|---|---|
| Can't sign in | See the table in section 2. |
| Dashboard shows "⚠ Could not reach server" by Ticket Queue | Check you're on the office network. Local checks still work. If the problem persists, tell your admin. |
| A health card says "Check failed" | Click **🔄 Refresh**. If it keeps failing, restart DeskSOS. |
| "Running in a browser — local machine diagnostics are only available in the DeskSOS desktop app." | You've opened DeskSOS in a web browser. Use the installed app from the Start menu. |
| A page stays on "Loading…" or shows ❌ with an error | Click **🔄 Refresh** (or the page's run button). Some checks take up to 30 seconds. |
| A fix fails with "Access is denied" or "requires elevation" | Run DeskSOS as administrator (section 5). If you aren't allowed, ask your admin. |
| Ticket submit shows a red error | Click **📋 Copy Ticket** to keep the report, then check the network and tell your admin. If your sign-in has expired, DeskSOS returns to the sign-in screen: sign in, gather diagnostics and submit again. |
| **📤 Submit to DeskSOS** is greyed out | Fill in **Issue Description**. |
| Submit/Copy section missing on the Ticket page | Click **🔍 Gather Diagnostics** first. |
| Ticket text disappeared | Signing out or closing DeskSOS clears it. Switching pages doesn't. |
| Chat shows an error or no channels | Check the network; sign out and back in. |
| Remote: the other person isn't under Online Users | They must be signed in with their own account, on the **Remote** page, and have clicked **Connect**. |
| Remote: stuck on "Establishing Connection" or a black screen | Both click **Disconnect**, then **Connect**, and try again. If it still fails, use chat or phone instead and report it. |
| No network after **IP Release** | Run **IP Renew** on the **Net Fixes** page. |
| Network is odd after a reset | Reboot the PC; the resets only take effect after a restart. |
| Windows SmartScreen blocks the installer | That's expected for the DeskSOS installer. Ask your admin before choosing **Run anyway**. |

---

## 8. Getting help

[Support contact — to be filled in by the owner (plan task 6.4)]

When you report a problem with DeskSOS itself, include:

- What you clicked and the exact error message (a screenshot helps).
- The computer name (shown on the **Dashboard**).
- The time it happened.
- The ticket number (e.g. `T-12345678`) if it's about a ticket.

# DeskSOS — IT Support Toolkit
## Product Overview & Value Proposition

**Version 1.0** | March 2026 | Platform: Windows (Desktop) · Android · iOS (Mobile)

---

## Executive Summary

DeskSOS is an enterprise-grade IT support toolkit built for help desk analysts, desktop support technicians, and IT administrators. It delivers a native Windows desktop application for on-site diagnostics and automation, a cross-platform mobile app for remote queue visibility and team coordination, and a real-time backend API that keeps every device in sync.

Where competing tools are either browser-dependent, feature-bloated, or require expensive licensing, DeskSOS is lightweight, offline-capable where it matters, and deployable across an entire domain in minutes via Group Policy.

---

## The Problem It Solves

IT support teams face a common set of daily friction points:

| Pain Point | Impact |
|------------|--------|
| Technicians must open multiple browser tabs or legacy tools to gather system information | Slows time-to-resolution; increases cognitive load |
| No single tool combines diagnostics, remediation, and process control | Forces context-switching between Task Manager, CMD, and vendor portals |
| Mobile technicians have no visibility into the ticket queue or team status | Tickets go unacknowledged; escalations missed |
| Asset identification in the field requires manual lookups | Delays hardware triage and loaner provisioning |
| Domain-wide software deployment requires custom scripting per organization | Increases deployment time and error risk |

DeskSOS addresses every one of these directly.

---

## Solution Overview

DeskSOS consists of three integrated components that work together as a unified support ecosystem:

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│       DeskSOS Desktop           │     │       DeskSOS Mobile            │
│  Native Windows Application     │     │  React Native (Android / iOS)   │
│                                 │     │                                 │
│  • System diagnostics           │     │  • Live ticket queue dashboard  │
│  • One-click network fixes      │     │  • Real-time team chat          │
│  • Process management           │     │  • QR/barcode asset scanner     │
│  • PowerShell terminal          │     │  • Network configuration view   │
│  • 100% offline capable         │     │  • Ticket list + status updates │
└─────────────────────────────────┘     └──────────────┬──────────────────┘
                                                        │ HTTPS + WebSocket
                                        ┌──────────────▼──────────────────┐
                                        │       DeskSOS Backend API       │
                                        │   Node.js · Express · Socket.IO │
                                        │                                 │
                                        │  • JWT authentication           │
                                        │  • Ticket CRUD & status engine  │
                                        │  • Real-time event broadcast    │
                                        │  • Asset & channel management   │
                                        └─────────────────────────────────┘
```

---

## Component 1: DeskSOS Desktop

A native Windows application built with Tauri 2.0 and Rust. Because it uses Rust for its native backend and WebView2 as its rendering layer, it installs in seconds and consumes a fraction of the memory of Electron-based alternatives.

### Feature Breakdown

#### System Dashboard
The landing screen gives technicians an immediate, accurate picture of the machine they are supporting — no more opening multiple dialogs or running manual commands.

- **CPU & RAM:** Polled in real time so resource pressure is visible at a glance
- **OS Details:** Full build version and edition displayed for compatibility checks
- **Network Health:** Color-coded status indicators for gateway reachability, DNS resolution, internet connectivity, and VPN presence
- **Uptime:** Displayed prominently to surface machines that have not been rebooted in weeks
- **Computer Name & Domain:** Ready to paste into a ticket without leaving the tool

#### Fix It Center
One-click automated remediation for the most common help desk requests:

| Category | Action | What It Does |
|----------|--------|--------------|
| Network | Flush DNS Cache | Clears the Windows DNS resolver cache (`ipconfig /flushdns`) |
| Network | Renew IP Address | Releases and renews DHCP lease |
| Network | Reset Network Stack | Resets Winsock and TCP/IP stack — resolves most persistent connectivity issues |
| Printer | Restart Print Spooler | Stops and restarts the spooler service to clear stuck jobs |
| Printer | Clear Print Queue | Removes all documents from the Windows print queue |
| System | Clear Temp Files | Purges `%TEMP%` to free disk space |

Each action runs a validated PowerShell command, captures its output, and surfaces success or failure in plain language. No command-line experience required.

#### Process Manager
A focused, real-time view of the top resource consumers on a machine:

- **Sort by CPU or Memory** to quickly find what is causing slowness
- **Kill Process** ends a stuck or rogue process with one click, with safe identification to prevent killing critical system processes
- **Refresh on demand** for a current snapshot at any point during a session

#### PowerShell Console
For advanced technicians who need to go beyond the built-in toolset:

- Integrated console accepts any PowerShell command
- Output is captured and displayed inside the application — no separate window
- Commands are validated before execution to prevent accidental destructive actions
- Administrator permission handling is managed transparently

### Desktop Key Advantages

- **No internet required.** The desktop app runs entirely offline. There is no dependency on a backend, cloud service, or VPN connection to perform diagnostics and fixes.
- **Minimal footprint.** Built on Rust + Tauri, the installer is a fraction of the size of Electron apps and consumes significantly less RAM at runtime.
- **Enterprise-ready deployment.** Ships with MSI and EXE installers, plus four PowerShell deployment scripts for GPO rollout, manual installation, verification, and uninstallation.

---

## Component 2: DeskSOS Mobile

A React Native 0.84 application targeting Android and iOS, designed for IT technicians who are mobile — walking the floor, visiting remote offices, or working from the field.

### Feature Breakdown

#### Live Dashboard
The first screen a technician sees when opening the app shows the state of the entire support team in real time:

- **Queue Metrics:** Open, In Progress, and Resolved ticket counts — refreshed live via pull-to-refresh and automatic polling
- **Average Response Time:** Team-level SLA visibility at a glance
- **Team Status Board:** Every active team member listed with their current status (Online / Away / Offline) and how many tickets they are working
- **Drill-down Navigation:** Tapping any metric card navigates directly to a filtered ticket list — e.g., tapping "12 Open" shows only open tickets; tapping a team member's name shows their assigned queue

#### Ticket Management
Full ticket lifecycle management from a mobile device:

- **Filtered Ticket List:** Sort and filter by status or assignee; each row shows priority badge, title, assignee, and last-updated timestamp
- **Ticket Detail View:** Full ticket content — description, priority (P1/P2/P3), status, creation date, assignee, and resolution notes
- **Status Transitions:** Change a ticket from Open → In Progress → Resolved directly from the detail screen; changes propagate to the backend and reflect instantly in the dashboard metrics

#### Real-Time Team Chat
A fully functional team messaging system built on Socket.IO:

- **Channel List:** All available team channels displayed with unread message badge counts
- **Message History:** Scrollable, timestamped message history per channel
- **Live Updates:** New messages appear without refresh, using WebSocket connections maintained by the backend

#### Asset Scanner
Eliminates the need for manual serial number lookups in the field:

- **Camera-Based Scanning:** Reads QR codes, Code-128, Code-39, EAN-13, and Data Matrix barcodes using React Native Vision Camera
- **Animated Scan Overlay:** Guided scanning frame with real-time detection feedback
- **Manual Entry Fallback:** If the barcode is damaged or unreadable, the technician can type the asset code directly
- **Asset Detail View:** Returns the full asset record — type, status, serial number, physical location, assigned user, and maintenance history

#### Network Information
Instant access to the mobile device's network configuration — useful when diagnosing connectivity from a specific location or VLAN:

- IPv4 and IPv6 addresses
- Default gateway
- DNS server list
- MAC address
- Network interface name

#### Authentication
- JWT-based login with persistent session — technicians stay logged in across app restarts
- Registration for new team members
- Biometric authentication support (fingerprint / Face ID) for fast access

### Mobile Key Advantages

- **True cross-platform.** One codebase deploys to both Android and iOS from a single React Native project.
- **Real-time everywhere.** Socket.IO keeps ticket counts, chat messages, and team statuses live without manual refresh.
- **Offline-aware design.** Navigation and cached data remain usable even when connectivity drops temporarily.

---

## Component 3: Backend API

A Node.js and Express API server that provides the data layer for the mobile application. It is intentionally lean — no heavyweight ORM, no microservices overhead — just a well-structured REST + WebSocket server that serves the mobile app's needs.

### API Surface

| Endpoint Group | Methods | Purpose |
|----------------|---------|---------|
| `/auth` | POST | Login, register, token refresh |
| `/dashboard` | GET | Queue metrics + team member status |
| `/tickets` | GET, PATCH | Ticket list (filterable), ticket detail, status update |
| `/chat` | GET | Channel list, per-channel message history |
| `/assets` | GET | Asset record lookup by QR/barcode code |
| `/network` | GET | Server-side network configuration info |

### Security Design

- All non-auth endpoints are protected by JWT middleware — unauthenticated requests receive `401 Unauthorized`
- Tokens are signed with a secret stored only in the server's `.env` file, never committed to source control
- The `.gitignore` globally excludes `.env` files across all project directories

### Real-Time Events

Socket.IO enables push-based updates to connected mobile clients:

- Ticket status changes are broadcast to all connected sessions
- New chat messages are delivered without polling
- Team status changes propagate in real time

---

## Technology Stack Summary

| Tier | Technology | Why |
|------|-----------|-----|
| Desktop frontend | React 18.3 + TypeScript | Familiar, type-safe, large ecosystem |
| Desktop native backend | Rust 1.92 + Tauri 2.0 | Memory-safe, tiny binary, native Windows API access |
| Desktop build | Vite 5.0 | Fast HMR in dev; optimized production bundles |
| Desktop styling | Tailwind CSS 3.4 | Utility-first; no runtime CSS overhead |
| Desktop installer | WiX (MSI) + NSIS (EXE) | Industry-standard enterprise distribution formats |
| Mobile framework | React Native 0.84 | Single TypeScript codebase for Android and iOS |
| Mobile navigation | React Navigation 7 | De facto standard; stack + tab navigators |
| Mobile state | @tanstack/react-query v5 | Declarative data fetching, caching, and invalidation |
| Mobile storage | @react-native-async-storage | Persistent key-value store for JWT tokens |
| Mobile camera | React Native Vision Camera | High-performance barcode/QR scanning |
| Mobile notifications | @notifee/react-native | Rich local and push notification support |
| Backend runtime | Node.js 22 | LTS; fast startup; natural fit for JavaScript team |
| Backend framework | Express 4 | Minimal, well-understood, extensive middleware ecosystem |
| Backend real-time | Socket.IO 4 | Reliable WebSocket abstraction with fallbacks |
| Backend auth | jsonwebtoken | Standard JWT signing and verification |

---

## Deployment

### Desktop — Enterprise Deployment (GPO)

DeskSOS Desktop ships with a complete PowerShell deployment suite:

```
deployment-package/
├── DeskSOS_1.0.0_x64_en-US.msi   ← Group Policy software deployment
├── DeskSOS_1.0.0_x64-setup.exe   ← Individual machine installation
├── GPO-Deployment.ps1             ← Automate MSI rollout via Group Policy
├── Manual-Deployment.ps1          ← Single-machine silent install
├── Verify-Installation.ps1        ← Confirm installation health
└── Uninstall.ps1                  ← Clean removal
```

A domain-wide rollout to hundreds of machines requires running one script and linking the GPO. No custom imaging or SCCM configuration is necessary.

### Mobile — Standard App Distribution

The mobile app follows standard React Native build and distribution workflows:

- **Android:** APK or AAB distributed via Google Play or MDM solution (e.g., Intune, Jamf)
- **iOS:** IPA distributed via TestFlight or Apple Business Manager

### Backend — Self-Hosted

The API server runs on any machine with Node.js 22+. For production, it can be containerized with Docker or deployed behind a reverse proxy (Nginx/Caddy) with TLS termination.

---

## Target Audience

| Role | Primary Use |
|------|-------------|
| Help Desk Analyst (Tier 1) | Desktop app for fast system checks and one-click fixes during live calls |
| Desktop Support Technician (Tier 2) | Desktop diagnostics + mobile asset scanning during on-site visits |
| IT Team Lead / Manager | Mobile dashboard for queue health monitoring and team workload visibility |
| IT Administrator | GPO deployment of the desktop app across the domain |
| Field Technician | Mobile app for ticket updates, team chat, and asset identification away from desk |

---

## Competitive Differentiators

### vs. Browser-Based Tools (e.g., web helpdesk portals)
- DeskSOS Desktop requires no browser, no VPN, and no internet — it works the instant a machine boots
- Native Windows API access via Rust enables system-level operations that a browser cannot perform

### vs. Electron-Based Desktop Apps
- Tauri + Rust produces a significantly smaller binary and lower memory footprint than Electron
- No bundled Chromium — uses WebView2, which is already present on all modern Windows machines

### vs. General-Purpose MDM / RMM Platforms
- DeskSOS is purpose-built for the frontline technician workflow, not for administrators configuring policies
- Zero per-seat licensing — self-hosted, open architecture
- Deployable and operational in under an hour

### vs. Standalone Mobile Ticketing Apps
- DeskSOS Mobile is tightly integrated with the desktop tool's backend — one auth system, one API, unified data
- Asset scanning is built in, not an add-on
- Real-time Socket.IO events keep every connected device in sync without polling

---

## Project Maturity

| Milestone | Status |
|-----------|--------|
| Desktop application built and packaged | ✅ Complete |
| MSI/EXE installers produced | ✅ Complete |
| PowerShell deployment suite written | ✅ Complete |
| Backend API with JWT auth and ticket CRUD | ✅ Complete |
| Mobile app (React Native) — all screens | ✅ Complete |
| Real-time chat via Socket.IO | ✅ Complete |
| QR/barcode asset scanner | ✅ Complete |
| Ticket list, detail, and status transitions | ✅ Complete |
| Live dashboard queue metrics | ✅ Complete |
| Mobile running on Android emulator | ✅ Verified |
| CI/CD pipeline | 🔲 Planned |
| Database persistence (SQLite / PostgreSQL) | 🔲 Planned |
| Push notification triggers from backend | 🔲 Planned |
| Tauri auto-updater | 🔲 Planned |

---

## Summary

DeskSOS is a production-ready, three-component IT support toolkit that meets technicians where they are — at a Windows workstation, walking the floor with a phone, or managing a team remotely. It eliminates the fragmented toolchain that most help desks operate with today and replaces it with a single, integrated, self-hosted solution that any IT organization can deploy, own, and extend.

---

*Document prepared March 2026 | DeskSOS v1.0 | github.com/hneal055/DESKSOS-Desktop-App-*
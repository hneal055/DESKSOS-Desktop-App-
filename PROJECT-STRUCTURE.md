# DeskSOS Project Structure

## ✅ Active Components

### Production Desktop Application
**Location:** `tauri-app/`
**Type:** Native Windows desktop app (Tauri + Rust + React)
**Users:** IT support technicians and help desk analysts
**Distribution:** MSI/EXE installers

### React Native Mobile Companion App
**Location:** `DeskSOSMobile/`
**Type:** React Native 0.84 (bare CLI) — Android + iOS
**Users:** IT technicians working away from their desk
**Features:** Live ticket queue, team chat, asset scanning, network info

### Node.js / Express Backend API
**Location:** `backend/`
**Type:** Node.js + Express + Socket.IO, port 5000
**Users:** Consumed by DeskSOSMobile; provides JWT auth, ticket CRUD, real-time events
**Seeded data:** 22 tickets, 4 chat channels, 3 assets, 2 users

### Deployment Package
**Location:** `deployment-package/`
**Contents:**
- DeskSOS_1.0.0_x64_en-US.msi - Enterprise MSI installer
- DeskSOS_1.0.0_x64-setup.exe - Standalone EXE installer
- PowerShell deployment scripts (GPO, Manual, Verify, Uninstall)
- User documentation (USER-GUIDE.md, QUICK-START.md)

## 🗑️ Removed Components (2026-02-25)

- ❌ deployment-package/client/ - Abandoned web prototype
- ❌ renderer/ - Incomplete enterprise backend

**Reason:** DeskSOS is a desktop-first application. Web components were early prototypes superseded by the Tauri implementation.

## 🏗️ Architecture

**Three-tier system: Desktop App + Mobile App + Backend API**

```
┌────────────────────────┐     ┌────────────────────────┐
│   DeskSOS Desktop      │     │   DeskSOS Mobile        │
│   (Tauri + Rust)       │     │   (React Native 0.84)   │
│   Offline capable      │     │   Android / iOS         │
└────────────────────────┘     └──────────┬─────────────┘
                                          │ HTTP + WS
                               ┌──────────▼─────────────┐
                               │   Backend API           │
                               │   Node.js + Express     │
                               │   + Socket.IO  :5000    │
                               └────────────────────────┘
```

**Desktop app:** 100% offline — no server required.
**Mobile app:** Requires backend running on port 5000.

## 🚀 Development Workflow

### Desktop App
```powershell
cd tauri-app
npm install
npm run tauri:dev          # Dev mode
npm run tauri:build        # Build MSI/EXE installers
# Output: tauri-app/src-tauri/target/release/bundle/
```

### Backend API
```powershell
cd backend                 # MUST be backend/ dir for .env to load
node server.js             # Starts on http://0.0.0.0:5000
```

### Mobile App
```powershell
cd DeskSOSMobile
npm install
npm run android            # Android emulator / device
npm run ios                # Requires macOS + Xcode
```

## 📦 Deployment

```powershell
cd deployment-package

# Domain-wide deployment (GPO)
.\GPO-Deployment.ps1

# Single machine
.\Manual-Deployment.ps1

# Verify installation
.\Verify-Installation.ps1

# Uninstall
.\Uninstall.ps1
```

## 🛠️ Technology Stack

### Desktop
| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18.3 + TypeScript 5.3 |
| **Styling** | Tailwind CSS 3.4 |
| **Native backend** | Rust 1.92 (Tauri 2.0) |
| **Runtime** | WebView2 (Chromium) |
| **Build** | Vite 5.0 |
| **Installers** | WiX Toolset (MSI) + NSIS (EXE) |

### Mobile
| Layer | Technology |
|-------|-----------|
| **Framework** | React Native 0.84 |
| **Language** | TypeScript |
| **Navigation** | React Navigation 7 (`@react-navigation/stack`) |
| **State / data** | @tanstack/react-query v5 + Context API |
| **HTTP** | Axios |
| **Real-time** | Socket.IO client |
| **Camera** | React Native Vision Camera |
| **Notifications** | @notifee/react-native |
| **Storage** | @react-native-async-storage v1.23.1 |

### Backend
| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22+ |
| **Framework** | Express 4 |
| **Auth** | jsonwebtoken (JWT) |
| **Real-time** | Socket.IO 4 |
| **Config** | dotenv |

## 📁 Directory Structure

```
DESKSOS/
├── DeskSOSMobile/                # React Native companion app
│   ├── src/
│   │   ├── config/
│   │   │   └── environment.ts        # API target (emulator / device / production)
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # JWT auth state + AsyncStorage persistence
│   │   ├── navigation/
│   │   │   ├── RootNavigator.tsx     # Auth-gate routing
│   │   │   ├── AuthNavigator.tsx     # Login / Register stack
│   │   │   ├── MainNavigator.tsx     # Bottom tab navigator
│   │   │   ├── DashboardNavigator.tsx  # Dashboard → TicketList → TicketDetail
│   │   │   ├── ChatNavigator.tsx     # Chat stack
│   │   │   └── AssetNavigator.tsx    # Asset scanner stack
│   │   ├── screens/
│   │   │   ├── auth/                 # LoginScreen, RegisterScreen
│   │   │   ├── dashboard/            # DashboardScreen (tappable metric cards)
│   │   │   ├── tickets/              # TicketListScreen, TicketDetailScreen
│   │   │   ├── chat/                 # ChatListScreen, ChatChannelScreen
│   │   │   ├── assets/               # AssetScannerScreen, AssetDetailScreen
│   │   │   ├── network/              # NetworkScreen
│   │   │   └── profile/              # ProfileScreen
│   │   ├── services/
│   │   │   ├── api.ts                # Axios instance + auth interceptor
│   │   │   ├── auth.ts               # Login / register
│   │   │   ├── dashboard.ts          # Queue metrics + team data
│   │   │   ├── tickets.ts            # Ticket list, detail, status update
│   │   │   ├── chat.ts               # Channel / message calls
│   │   │   ├── assets.ts             # Asset lookup by QR/barcode
│   │   │   ├── network.ts            # Device network info
│   │   │   └── socket.ts             # Socket.IO connection
│   │   └── types/
│   │       └── index.ts              # Shared TypeScript types + nav param lists
│   ├── App.tsx                       # Root + ErrorBoundary + QueryClient
│   └── package.json
│
├── backend/                      # Node.js + Express API (port 5000)
│   ├── routes/
│   │   ├── auth.js               # POST /auth/login, /auth/register, /auth/refresh
│   │   ├── dashboard.js          # GET /dashboard/queue, /dashboard/team
│   │   ├── tickets.js            # GET /tickets, /tickets/:id  PATCH /tickets/:id
│   │   ├── chat.js               # GET /chat/channels, /chat/:id/messages
│   │   ├── assets.js             # GET /assets/:code
│   │   └── network.js            # GET /network/info
│   ├── data/
│   │   └── store.js              # In-memory seed (22 tickets, users, channels, assets)
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware
│   ├── server.js                 # Express + Socket.IO entry (dotenv via __dirname)
│   └── .env                      # PORT=5000, JWT_SECRET
│
├── tauri-app/                    # Main desktop application
│   ├── src/                      # React frontend
│   │   ├── App.tsx               # Main UI (4 modules)
│   │   ├── main.tsx              # Entry point
│   │   └── styles.css            # Tailwind CSS
│   ├── src-tauri/                # Rust backend
│   │   ├── src/
│   │   │   ├── lib.rs            # Tauri invoke commands
│   │   │   └── main.rs           # Entry point
│   │   ├── Cargo.toml            # Rust dependencies
│   │   └── tauri.conf.json       # App configuration
│   ├── package.json
│   └── vite.config.ts
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
```

## 🎯 Feature Modules

### Desktop
1. **Dashboard** - System overview (CPU, RAM, OS) and quick actions
2. **Fix It Center** - Network fixes, printer troubleshooting, temp cleanup
3. **Process Management** - Task manager with kill capability
4. **PowerShell Terminal** - Integrated command-line interface

### Mobile
1. **Dashboard** - Live ticket queue metrics + team status; tappable cards → filtered ticket list
2. **Tickets** - Ticket list (filterable by status / assignee) + detail with status transitions
3. **Chat** - Real-time team messaging via Socket.IO
4. **Assets** - QR/barcode scanner + asset detail view
5. **Network** - Live device network configuration

## 📝 Next Steps

1. ✅ Remove web components (completed)
2. ✅ Add React Native mobile companion app (completed)
3. ✅ Add Node.js backend API (completed)
4. ⬜ Add CI/CD pipeline for automated builds
5. ⬜ Implement update checker (Tauri updater)
6. ⬜ Add push notifications via @notifee (backend trigger)
7. ⬜ Persist ticket data to SQLite or PostgreSQL

---

For support, see deployment-package/USER-GUIDE.md
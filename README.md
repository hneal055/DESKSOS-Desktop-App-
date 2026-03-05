# DeskSOS - Desktop Support Toolkit

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Windows](https://img.shields.io/badge/platform-Windows-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![Rust](https://img.shields.io/badge/Rust-1.92-orange)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![Mobile](https://img.shields.io/badge/mobile-React%20Native%200.84-61dafb)

DeskSOS is a full IT support toolkit — a native Windows desktop application paired with a React Native mobile companion app. The desktop app provides system diagnostics, network troubleshooting, process management, and PowerShell automation. The mobile app extends the toolkit with real-time team chat, asset scanning, and remote queue visibility for technicians on the go.

## 🎯 Overview

DeskSOS Desktop is a lightweight, native Windows application designed for help desk analysts and desktop support technicians. It provides instant access to common troubleshooting tools without requiring a browser or network connectivity.

**Perfect for:**
- Help Desk Analysts performing first-line support
- Desktop Support Technicians diagnosing issues
- IT Administrators managing workstations
- System Engineers running diagnostics

## ✨ Key Features

### 🏠 System Dashboard
- Real-time system information (CPU, RAM, OS version)
- Network health monitoring (Gateway, DNS, Internet, VPN)
- Uptime tracking
- Computer identification for ticketing

### 🔧 Fix It Center
**Network Tools:**
- Flush DNS Cache - Clear DNS resolver cache
- Renew IP Address - Request new DHCP address
- Reset Network Stack - Full Winsock/TCP-IP reset

**Printer Tools:**
- Restart Print Spooler - Fix stuck print jobs
- Clear Print Queue - Remove all queued documents

**System Maintenance:**
- Clear Temp Files - Free up disk space

### 📊 Process Manager
- View top processes by CPU/Memory usage
- Kill unresponsive applications
- Real-time resource monitoring
- Safe process identification

### 💻 PowerShell Console
- Execute custom PowerShell commands
- Built-in command validation
- Output capture and display
- Administrator permission handling

---

## 📱 DeskSOS Mobile (Companion App)

A React Native mobile application for Android and iOS, designed for IT technicians who need team visibility and asset management away from their desk.

### Mobile Features

#### Dashboard

- Live ticket queue metrics (Open / In Progress / Resolved)
- Average response time tracking
- Team member status board (online / away / offline) with active ticket counts
- Pull-to-refresh

#### Chat

- Real-time team messaging via Socket.IO
- Channel list with unread badge counts
- Per-channel message history with timestamps

#### Asset Management

- QR code and barcode scanner (QR, Code-128, Code-39, EAN-13, Data Matrix)
- Animated scan overlay with manual code entry fallback
- Asset detail view (type, status, serial number, location, assigned user, maintenance history)

#### Network Info

- Live device network configuration (IPv4, IPv6, gateway, DNS servers, MAC address)

#### Authentication

- JWT-based login and registration
- Persistent session via AsyncStorage
- Biometric authentication support

### Mobile Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | React Native 0.84 |
| Language | TypeScript |
| Navigation | React Navigation 7 (stack + bottom tabs) |
| State | React Query + Context API |
| HTTP | Axios |
| Real-time | Socket.IO client |
| Camera | React Native Vision Camera |
| Icons | Ionicons (react-native-vector-icons) |
| Background | react-native-background-fetch |
| Notifications | react-native-push-notification |

### Mobile Project Structure

```
DeskSOSMobile/
├── src/
│   ├── config/
│   │   └── environment.ts        # API base URL config (emulator / device / production)
│   ├── context/
│   │   └── AuthContext.tsx       # Auth state + JWT persistence
│   ├── navigation/
│   │   ├── RootNavigator.tsx     # Auth vs Main routing
│   │   ├── AuthNavigator.tsx     # Login / Register stack
│   │   ├── MainNavigator.tsx     # Bottom tab navigator
│   │   ├── ChatNavigator.tsx     # Chat stack
│   │   └── AssetNavigator.tsx    # Asset scanner stack
│   ├── screens/
│   │   ├── auth/                 # LoginScreen, RegisterScreen
│   │   ├── dashboard/            # DashboardScreen
│   │   ├── chat/                 # ChatListScreen, ChatChannelScreen
│   │   ├── assets/               # AssetScannerScreen, AssetDetailScreen
│   │   ├── network/              # NetworkScreen
│   │   └── profile/              # ProfileScreen
│   ├── services/
│   │   ├── api.ts                # Axios instance
│   │   ├── auth.ts               # Login/register calls
│   │   ├── dashboard.ts          # Queue/team data
│   │   ├── chat.ts               # Channel/message calls
│   │   ├── assets.ts             # Asset lookup by code
│   │   ├── network.ts            # Network info
│   │   └── socket.ts             # Socket.IO connection
│   └── types/
│       └── index.ts              # Shared TypeScript types
└── package.json
```

### Mobile API Targets

Configure the backend target in `src/config/environment.ts`:

```typescript
// Switch between: 'emulator' | 'device' | 'production'
const TARGET: Target = 'emulator';
```

| Target | Enterprise API | Network API |
| ------ | -------------- | ----------- |
| `emulator` | `http://10.0.2.2:5000` | `http://10.0.2.2:3000` |
| `device` | `http://<LAN_IP>:5000` | `http://<LAN_IP>:3000` |
| `production` | `https://<domain>/api` | `https://<domain>` |

### Mobile Development Setup

**Prerequisites:** Node.js 22+, React Native CLI, Android Studio (Android) or Xcode (iOS)

```bash
cd DeskSOSMobile
npm install

# Android
npm run android

# iOS
npm run ios
```

---

## 🚀 Quick Start

### For End Users

1. **Download Installer**
   - MSI: `DeskSOS_1.0.0_x64_en-US.msi` (Enterprise/GPO deployment)
   - EXE: `DeskSOS_1.0.0_x64-setup.exe` (Standalone installer)

2. **Install**
   ```powershell
   # Double-click installer OR
   # Silent install (admin required):
   msiexec /i DeskSOS_1.0.0_x64_en-US.msi /quiet
   ```

3. **Launch**
   - Desktop shortcut: `DeskSOS`
   - Start menu: Search "DeskSOS"
   - Direct: `C:\Program Files\DeskSOS\DeskSOS.exe`

### For IT Administrators

**Group Policy Deployment:**
```powershell
.\deployment-package\GPO-Deployment.ps1 -NetworkSharePath "\\server\share" -OUPath "OU=IT,DC=domain,DC=com"
```

**Manual Deployment:**
```powershell
.\deployment-package\Manual-Deployment.ps1
```

**Verify Installation:**
```powershell
.\deployment-package\Verify-Installation.ps1
```

See [USER-GUIDE.md](deployment-package/USER-GUIDE.md) for complete documentation.

## 📋 System Requirements

| Component | Requirement |
|-----------|-------------|
| **Operating System** | Windows 10 (1809+) or Windows 11 |
| **RAM** | 100 MB minimum |
| **Disk Space** | 10 MB |
| **Permissions** | Standard user (some features require admin) |
| **Network** | Offline capable |

## 🏗️ Architecture

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

## 🛠️ Technology Stack

**Frontend:**
- **Tauri 2.0** - Native desktop framework
- **React 18.3** - UI library
- **TypeScript** - Type safety
- **Vite 6.4** - Build tool
- **Tailwind CSS** - Styling

**Backend:**
- **Rust 1.92** - System operations
- **Serde** - Serialization
- **PowerShell** - Command execution

**Build Tools:**
- **WiX 3.14** - MSI installer generation
- **NSIS 3.11** - EXE installer creation

## 📦 Project Structure

```
DESKSOS/
├── tauri-app/                    # Main application
│   ├── src/                      # React frontend
│   │   ├── App.tsx              # Main UI component
│   │   └── main.tsx             # Entry point
│   └── src-tauri/               # Rust backend
│       ├── src/
│       │   ├── lib.rs           # Command implementations
│       │   └── main.rs          # Entry point
│       ├── Cargo.toml           # Rust dependencies
│       └── tauri.conf.json      # Tauri configuration
├── deployment-package/           # Enterprise deployment
│   ├── DeskSOS_1.0.0_x64_en-US.msi
│   ├── DeskSOS_1.0.0_x64-setup.exe
│   ├── GPO-Deployment.ps1
│   ├── Manual-Deployment.ps1
│   ├── Verify-Installation.ps1
│   ├── Uninstall.ps1
│   ├── README.md
│   ├── QUICK-START.md
│   └── USER-GUIDE.md            # Comprehensive manual
└── README.md                     # This file
```

## 🔨 Development Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** 1.92+ (install via [rustup](https://rustup.rs/))
- **Visual Studio Build Tools** (Windows SDK)

### Clone & Install

```bash
git clone https://github.com/hneal055/DESKSOS-Desktop-App-.git
cd DESKSOS-Desktop-App-
cd tauri-app
npm install
```

### Run Development Mode

```bash
npm run tauri:dev
```

### Build Production

```bash
npm run tauri:build
```

Output: `tauri-app/src-tauri/target/release/bundle/`

## 🧪 Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build frontend only |
| `npm run tauri:dev` | Run Tauri app in dev mode |
| `npm run tauri:build` | Build production installers |

## 📖 Documentation

- [USER-GUIDE.md](deployment-package/USER-GUIDE.md) - Complete user manual
- [QUICK-START.md](deployment-package/QUICK-START.md) - Fast deployment guide
- [deployment-package/README.md](deployment-package/README.md) - Package overview

## 🔐 Security

- **No External APIs** - Fully offline capable
- **Native Windows APIs** - Direct system access
- **No Data Collection** - No telemetry or tracking
- **Admin Checks** - UAC prompts for privileged operations
- **Safe Defaults** - Read-only operations when possible

## 🚧 Roadmap

- [ ] Active Directory module (user management)
- [ ] SQLite knowledge base
- [ ] Automated repair scripts
- [ ] Remote assistance integration
- [ ] Custom plugin system
- [ ] Multi-monitor support
- [ ] Dark/Light theme toggle

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software for internal use only.

**© 2026 DeskSOS Team. All rights reserved.**

## 👥 Authors

- **DeskSOS Team** - Initial work

## 🐛 Bug Reports

Found a bug? Please open an issue with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- System information (from Dashboard)

## 💬 Support

- **Email:** it-support@company.com
- **Issues:** [GitHub Issues](https://github.com/hneal055/DESKSOS-Desktop-App-/issues)
- **Documentation:** [USER-GUIDE.md](deployment-package/USER-GUIDE.md)

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI components inspired by modern desktop applications
- Icons from system libraries

---

**Made with ❤️ for IT Support Teams**

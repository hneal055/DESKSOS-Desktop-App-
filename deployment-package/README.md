# DeskSOS deployment package

This folder holds scripts and documents for installing the DeskSOS desktop app on users' PCs. **The installers aren't stored here**, because build outputs are kept out of git. Build them first (step 1).

The full procedure is in [docs/OPERATIONS.md §6](../docs/OPERATIONS.md#6-desktop-app-building-and-distributing). This page is a summary.

## 1. Build the installers

On the build PC (FORD-DC01):

```powershell
cd C:\Projects\DESKSOS-Desktop\tauri-app
npm ci
npm run tauri build
```

The output is in `tauri-app\src-tauri\target\release\bundle\`:

| File | Use |
|---|---|
| `nsis\DeskSOS_<version>_x64-setup.exe` | **Recommended.** Installs WebView2 if it's missing |
| `msi\DeskSOS_<version>_x64_en-US.msi` | Scripted or managed deployment (the scripts below, Intune) |

Release builds connect to `https://FORD-DC01:5443`, as set in `tauri-app/.env.production`. Increase `version` in `tauri-app/src-tauri/tauri.conf.json` for each new release.

## 2. Before installing on a PC

1. **Trust the DeskSOS certificate authority once per PC.** Without this the app can't reach the server. Copy `rootCA.pem` (never `rootCA-key.pem`) from `mkcert -CAROOT` on the server, then on the PC, in an elevated window:
   ```powershell
   Import-Certificate -FilePath .\rootCA.pem -CertStoreLocation Cert:\LocalMachine\Root
   ```
   Then check that `https://FORD-DC01:5443/health` opens in Edge without a warning.
2. **Create the user's account** on the server. Don't share the admin login.

The installers aren't code-signed yet, so SmartScreen shows "Windows protected your PC". Choose **More info → Run anyway**. Signing is plan task 5.1.

## Contents of this folder

| File | Purpose |
|---|---|
| [QUICK-START.md](QUICK-START.md) | Installing on one PC, step by step |
| `Manual-Deployment.ps1` | Installs the MSI on the PC it runs on |
| `GPO-Deployment.ps1` | Group Policy deployment. **Doesn't apply to FORD-DC01's network:** it's a workgroup with no domain. Kept for future use |
| `Verify-Installation.ps1` | Checks an installed PC |
| `Uninstall.ps1` | Removes the app |
| `DeskSOS-Validation.ps1` | A broader validation script |
| `USER-GUIDE.md`, `TESTING-CHECKLIST.md`, `VALIDATION-CHECKLIST.md` | **Outdated.** They're from February 2026, before sign-in, tickets and the server existed. They'll be rewritten in Phase 6 (user guides) |

The deployment scripts were written for the February installers. Test them against the current MSI name and version before relying on them (plan Phase 5).

## Updating and uninstalling

- **Update:** build with a higher version and run the new installer over the old one. Settings and sign-in are kept, and there's no auto-updater.
- **Uninstall:** Settings → Apps → **DeskSOS** → Uninstall, or `Uninstall.ps1`. See OPERATIONS §6.5 for removing the certificate.

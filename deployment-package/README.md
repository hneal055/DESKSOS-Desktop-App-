# DeskSOS deployment package

This folder holds scripts and documents for installing the DeskSOS desktop app on users' PCs. **The installers aren't stored here**, because build outputs are kept out of git. Build a release first (step 1).

The full procedure is in [docs/OPERATIONS.md §6](../docs/OPERATIONS.md#6-desktop-app-building-and-distributing). This page is a summary.

## 1. Build a signed release

On the build PC (FORD-DC01), in PowerShell 7:

```powershell
& "C:\Program Files\PowerShell\7\pwsh.exe" -NoProfile -File C:\Projects\DESKSOS-Desktop\tauri-app\scripts\build-release.ps1
```

It builds and signs everything, then puts it in **`release\DeskSOS-<version>\`** at the repository root:

| File | Use |
|---|---|
| `DeskSOS_<version>_x64-setup.exe` | **Recommended** installer. It installs WebView2 if missing |
| `DeskSOS_<version>_x64_en-US.msi` | Scripted or managed deployment |
| `desksos-ca.crt`, `desksos-codesign.cer` | The two public certificates each PC must trust |
| `Trust-DeskSOS.ps1` | Trusts both certificates (run once per PC, as administrator) |
| `SHA256SUMS.txt` | Checksums, to confirm a copy is intact |

Release builds connect to `https://FORD-DC01:5443` (`tauri-app/.env.production`), and are signed by **DeskSOS Internal Code Signing**. That's a self-made certificate for the local office (decision D4); Azure Artifact Signing is to be revisited before any wider rollout. Increase `version` in `tauri-app/src-tauri/tauri.conf.json` for each new release.

## 2. On each PC

Copy the release folder to the PC (USB stick or network share), then follow [QUICK-START.md](QUICK-START.md):

1. Run `Trust-DeskSOS.ps1` as administrator, once.
2. Run the setup `.exe`.
3. Sign in with the user's own account.

## Contents of this folder

| File | Purpose |
|---|---|
| [QUICK-START.md](QUICK-START.md) | Installing on one PC, step by step |
| `Trust-DeskSOS.ps1` | Per-PC trust setup (`-Check`, `-Remove`). The build copies it into each release folder |
| `Manual-Deployment.ps1` | Installs the MSI on the PC it runs on |
| `GPO-Deployment.ps1` | Group Policy deployment. **Doesn't apply to FORD-DC01's network:** it's a workgroup with no domain. Kept for future use |
| `Verify-Installation.ps1` | Checks an installed PC |
| `Uninstall.ps1` | Removes the app |
| `DeskSOS-Validation.ps1` | A broader validation script |
| `USER-GUIDE.md`, `TESTING-CHECKLIST.md`, `VALIDATION-CHECKLIST.md` | **Outdated.** They're from February 2026, before sign-in, tickets and the server existed. They'll be rewritten in Phase 6 (user guides) |

The older deployment scripts were written for the February installers. Test them against the current MSI name and version before relying on them (plan Phase 5).

## Updating and uninstalling

- **Update:** build with a higher version and run the new installer over the old one. Settings and sign-in are kept, and there's no auto-updater.
- **Uninstall:** Settings → Apps → **DeskSOS** → Uninstall, or `Uninstall.ps1`. `Trust-DeskSOS.ps1 -Remove` removes the certificates.

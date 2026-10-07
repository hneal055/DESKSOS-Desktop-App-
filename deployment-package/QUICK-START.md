# DeskSOS: install on one PC

This takes about 5 minutes per PC. You need administrator rights on the PC and a **release folder**, `release\DeskSOS-<version>\`, built on FORD-DC01 with `build-release.ps1` (see [README.md](README.md), step 1). Copy the whole folder to the PC by USB stick or network share.

## 1. Trust DeskSOS (once per PC)

The app and the Enterprise dashboard use DeskSOS's own certificate authority for HTTPS, and the installer is signed with DeskSOS's own code-signing certificate. Without this step, the app can't connect.

1. In the release folder, right-click an empty area → **Open in Terminal**, or open PowerShell there, **as administrator**.
2. **Check who signed the setup script** before running it as administrator:
   ```powershell
   (Get-AuthenticodeSignature .\Trust-DeskSOS.ps1).SignerCertificate.Thumbprint
   ```
   It must print the **code-signing fingerprint** published in [docs/OPERATIONS.md §6.3](../docs/OPERATIONS.md) on GitHub. Read it there, not from this folder. If it doesn't match, stop and tell your administrator.
3. Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Trust-DeskSOS.ps1
   ```
   It shows both fingerprints. Compare them with §6.3, then type `YES`. It reports both certificates as **added** (or **already trusted**). Both are public certificates, and running it again is harmless.
4. **Close every browser window**, including any browser icon in the system tray.
5. Check: open **https://FORD-DC01:5443/health** in Edge. You should see `{"status":"ok",...}` with no certificate warning.
   - **Certificate warning:** run `.\Trust-DeskSOS.ps1 -Check` to see what's missing.
   - **The page doesn't load:** check that the PC is on the office network. Run `ipconfig`: its address should start with `192.168.12.`.

## 2. Install the app

Run **`DeskSOS_<version>_x64-setup.exe`** (recommended) or the `.msi`. Windows shows **DeskSOS** as the verified publisher.

If the installer was downloaded through a browser or email rather than copied, Windows SmartScreen may still say "Windows protected your PC". Choose **More info → Run anyway**.

## 3. Sign in

1. An admin creates the user's account on the server. Don't share the admin login.
2. Start **DeskSOS** from the Start menu and sign in with that account. How to use the app: [docs/TECHNICIAN-GUIDE.md](../docs/TECHNICIAN-GUIDE.md).

## Notes

- **Admin rights:** Renew IP, Reset Network and Clear Print Queue need **Run as administrator**.
- **Updates:** run the newer installer over the old one. Settings and sign-in are kept, and the trust step isn't needed again unless the signing certificate changes.
- **Removing the trust:** `.\Trust-DeskSOS.ps1 -Remove`.
- **Problems:** see "Troubleshooting" in [docs/OPERATIONS.md](../docs/OPERATIONS.md#7-troubleshooting).

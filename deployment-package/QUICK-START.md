# DeskSOS: install on one PC

This takes about 5 minutes per PC. You need administrator rights on the PC and the installer built from `tauri-app` (see [README.md](README.md), step 1).

## 1. Trust the DeskSOS certificate (once per PC)

The app talks to the server over HTTPS using DeskSOS's own certificate authority. Without this step, it can't connect.

1. On the server, run `mkcert -CAROOT` and copy **`rootCA.pem`** from that folder to a USB stick or share.
   **Never copy `rootCA-key.pem`.**
2. On the PC, open PowerShell **as administrator** in the folder with `rootCA.pem`:
   ```powershell
   Import-Certificate -FilePath .\rootCA.pem -CertStoreLocation Cert:\LocalMachine\Root
   ```
3. Check it: open **https://FORD-DC01:5443/health** in Edge. You should see `{"status":"ok",...}` with no certificate warning.
   - Certificate warning: step 2 didn't take.
   - The page doesn't load: check that the PC is on the office network, and that its Wi-Fi network is set to **Private**.

## 2. Install the app

Run **`DeskSOS_<version>_x64-setup.exe`** (recommended) or the `.msi`.

The installer isn't code-signed yet, so Windows shows "Windows protected your PC". Choose **More info → Run anyway**.

## 3. Sign in

1. An admin creates the user's account on the server. Don't share the admin login.
2. Start **DeskSOS** from the Start menu and sign in with that account. How to use the app: [docs/TECHNICIAN-GUIDE.md](../docs/TECHNICIAN-GUIDE.md).

## Notes

- **Admin rights:** Renew IP, Reset Network, Clear Print Queue and the AD tools need **Run as administrator**. The AD tools also need a domain-joined PC.
- **Updates:** run the newer installer over the old one. Settings and sign-in are kept.
- **Problems:** see "Troubleshooting" in [docs/OPERATIONS.md](../docs/OPERATIONS.md#7-troubleshooting).

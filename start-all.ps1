# ==============================================================================
# DeskSOS Complete Clean & Master Startup Script
# ==============================================================================

$RootPath = $PSScriptRoot  # the folder this script lives in, so it never points at a stale copy
$BackendPath = Join-Path $RootPath "backend"
$TauriAppPath = Join-Path $RootPath "tauri-app"

Write-Host "🧹 [1/2] Stopping this repo's dev processes, freeing ports, clearing Vite cache..." -ForegroundColor Cyan
# clean-env.ps1 stops only processes attributed to this repo; other projects
# (e.g. the Enterprise backend on port 5000) and PM2/production are left running.
& (Join-Path $RootPath "clean-env.ps1")

Write-Host "🚀 [2/2] Launching Backend and Tauri Frontend concurrently..." -ForegroundColor Cyan

# 1. Launch Backend Gateway in a split PowerShell window
#    JWT_SECRET is cleared so backend/.env supplies it: dotenv never overrides an
#    existing variable, and a stale Windows user-level JWT_SECRET would win.
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; Remove-Item Env:JWT_SECRET -ErrorAction SilentlyContinue; Write-Host '===============================' -ForegroundColor DarkGray; Write-Host ' DeskSOS Backend Gateway' -ForegroundColor Green; Write-Host '===============================' -ForegroundColor DarkGray; npm run dev"

# Brief pause to let the backend bind its port safely
Start-Sleep -Seconds 2

# 2. Launch Tauri Frontend / Desktop Wrapper in a split PowerShell window
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$TauriAppPath'; Write-Host '===============================' -ForegroundColor DarkGray; Write-Host ' DeskSOS Tauri Desktop App' -ForegroundColor Blue; Write-Host '===============================' -ForegroundColor DarkGray; npm run tauri dev"

Write-Host "✨ Master startup sequence complete! Check the new terminal windows and desktop app." -ForegroundColor Green
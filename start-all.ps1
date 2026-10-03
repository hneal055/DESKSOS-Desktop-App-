# ==============================================================================
# DeskSOS Complete Clean & Master Startup Script
# ==============================================================================

$RootPath = $PSScriptRoot  # the folder this script lives in, so it never points at a stale copy
$BackendPath = Join-Path $RootPath "backend"
$TauriAppPath = Join-Path $RootPath "tauri-app"

Write-Host "🧹 [1/4] Terminating active Node, Rust, and Tauri processes..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process desksos -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process cargo -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "🔌 [2/4] Freeing up local development ports (5000, 5001, 1420)..." -ForegroundColor Cyan
$ports = @(5000, 5001, 1420)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        if ($processId -and $processId -ne 0) {
            Write-Host " -> Stopping Process ID $processId holding port $port" -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "🗑️ [3/4] Clearing Vite compilation caches..." -ForegroundColor Cyan
$viteCachePath = Join-Path $TauriAppPath "node_modules\.vite"
if (Test-Path $viteCachePath) {
    Remove-Item -Recurse -Force $viteCachePath
    Write-Host " -> Cleared Vite cache successfully." -ForegroundColor Green
}

Write-Host "🚀 [4/4] Launching Backend and Tauri Frontend concurrently..." -ForegroundColor Cyan

# 1. Launch Backend Gateway in a split PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendPath'; Write-Host '===============================' -ForegroundColor DarkGray; Write-Host ' DeskSOS Backend Gateway' -ForegroundColor Green; Write-Host '===============================' -ForegroundColor DarkGray; npm run dev"

# Brief pause to let the backend bind its port safely
Start-Sleep -Seconds 2

# 2. Launch Tauri Frontend / Desktop Wrapper in a split PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$TauriAppPath'; Write-Host '===============================' -ForegroundColor DarkGray; Write-Host ' DeskSOS Tauri Desktop App' -ForegroundColor Blue; Write-Host '===============================' -ForegroundColor DarkGray; npm run tauri dev"

Write-Host "✨ Master startup sequence complete! Check the new terminal windows and desktop app." -ForegroundColor Green
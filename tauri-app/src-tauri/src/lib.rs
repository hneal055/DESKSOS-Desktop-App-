// DeskSOS Desktop Support Application - Rust Backend
// Windows System Diagnostics & Automation

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::os::windows::process::CommandExt;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    computer_name: String,
    os_version: String,
    ip_address: String,
    mac_address: String,
    disk_space_gb: String,
    memory_gb: String,
    uptime: String,
    domain: String,
    logged_in_user: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkHealth {
    gateway_ping: bool,
    dns_ping: bool,
    internet_ping: bool,
    vpn_status: String,
    packet_loss: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessInfo {
    name: String,
    pid: u32,
    cpu_percent: f32,
    memory_mb: f32,
}

// COMMAND: Get full system information
#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String> {
    let computer_name = run_powershell("$env:COMPUTERNAME")?;
    let os_version = run_powershell("(Get-WmiObject -Class Win32_OperatingSystem).Caption + ' - Build ' + (Get-WmiObject -Class Win32_OperatingSystem).BuildNumber")?;
    let ip_address = run_powershell("(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike '*Loopback*'} | Select-Object -First 1).IPAddress")?;
    let mac_address = run_powershell("(Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1).MacAddress")?;
    let disk_space = run_powershell("$drive = Get-PSDrive C; \"$([math]::Round($drive.Free/1GB, 2))GB / $([math]::Round(($drive.Used + $drive.Free)/1GB, 2))GB\"")?;
    let memory = run_powershell("\"$([math]::Round((Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory/1GB, 2))GB\"")?;
    let uptime = run_powershell("$bootTime = (Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime; $uptime = (Get-Date) - $bootTime; \"$($uptime.Days)d $($uptime.Hours)h $($uptime.Minutes)m\"")?;
    let domain = run_powershell("(Get-WmiObject -Class Win32_ComputerSystem).Domain")?;
    let user = run_powershell("$env:USERNAME")?;

    Ok(SystemInfo {
        computer_name: computer_name.trim().to_string(),
        os_version: os_version.trim().to_string(),
        ip_address: ip_address.trim().to_string(),
        mac_address: mac_address.trim().to_string(),
        disk_space_gb: disk_space.trim().to_string(),
        memory_gb: memory.trim().to_string(),
        uptime: uptime.trim().to_string(),
        domain: domain.trim().to_string(),
        logged_in_user: user.trim().to_string(),
    })
}

// COMMAND: Network health check
#[tauri::command]
async fn check_network_health() -> Result<NetworkHealth, String> {
    let gateway_test = run_powershell("Test-Connection -ComputerName (Get-NetRoute -DestinationPrefix '0.0.0.0/0').NextHop -Count 1 -Quiet")?;
    let dns_test = run_powershell("Test-Connection -ComputerName 1.1.1.1 -Count 1 -Quiet")?;
    let internet_test = run_powershell("Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet")?;
    let vpn_status = run_powershell("(Get-VpnConnection -ErrorAction SilentlyContinue | Where-Object {$_.ConnectionStatus -eq 'Connected'}).Name")?;

    Ok(NetworkHealth {
        gateway_ping: gateway_test.trim() == "True",
        dns_ping: dns_test.trim() == "True",
        internet_ping: internet_test.trim() == "True",
        vpn_status: if vpn_status.trim().is_empty() { "Disconnected".to_string() } else { vpn_status.trim().to_string() },
        packet_loss: 0.0,
    })
}

// COMMAND: Flush DNS cache
#[tauri::command]
async fn flush_dns() -> Result<String, String> {
    run_powershell("Clear-DnsClientCache; 'DNS cache cleared successfully'")
}

// COMMAND: Release and renew IP
#[tauri::command]
async fn renew_ip() -> Result<String, String> {
    run_powershell("ipconfig /release; ipconfig /renew; 'IP address renewed'")?;
    Ok("IP address renewed successfully".to_string())
}

// COMMAND: Reset network stack
#[tauri::command]
async fn reset_network() -> Result<String, String> {
    run_powershell("netsh winsock reset; netsh int ip reset; 'Network stack reset - reboot required'")?;
    Ok("Network stack reset. Please reboot for changes to take effect.".to_string())
}

// COMMAND: Get top processes by CPU/Memory
#[tauri::command]
async fn get_top_processes(limit: usize) -> Result<Vec<ProcessInfo>, String> {
    let output = run_powershell(&format!(
        "Get-Process | Sort-Object CPU -Descending | Select-Object -First {} | ForEach-Object {{ \"{{0}}|{{1}}|{{2}}|{{3}}\" -f $_.Name, $_.Id, $_.CPU, [math]::Round($_.WorkingSet/1MB, 2) }}",
        limit
    ))?;

    let processes: Vec<ProcessInfo> = output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() == 4 {
                Some(ProcessInfo {
                    name: parts[0].to_string(),
                    pid: parts[1].parse().unwrap_or(0),
                    cpu_percent: parts[2].parse().unwrap_or(0.0),
                    memory_mb: parts[3].parse().unwrap_or(0.0),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(processes)
}

// COMMAND: Kill process by PID
#[tauri::command]
async fn kill_process(pid: u32) -> Result<String, String> {
    run_powershell(&format!("Stop-Process -Id {} -Force; 'Process {} terminated'", pid, pid))
}

// COMMAND: Clear temp files
#[tauri::command]
async fn clear_temp_files() -> Result<String, String> {
    let script = r#"
        $tempPaths = @("$env:TEMP\*", "$env:LOCALAPPDATA\Temp\*", "C:\Windows\Temp\*")
        $freedSpace = 0
        foreach ($path in $tempPaths) {
            $items = Get-ChildItem -Path $path -ErrorAction SilentlyContinue
            $size = ($items | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            $freedSpace += $size
            Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        }
        "Cleared $([math]::Round($freedSpace/1MB, 2))MB of temp files"
    "#;
    run_powershell(script)
}

// COMMAND: Restart print spooler
#[tauri::command]
async fn restart_print_spooler() -> Result<String, String> {
    run_powershell("Stop-Service -Name Spooler -Force; Start-Sleep -Seconds 2; Start-Service -Name Spooler; 'Print spooler restarted'")?;
    Ok("Print spooler restarted successfully".to_string())
}

// COMMAND: Clear print queue
#[tauri::command]
async fn clear_print_queue() -> Result<String, String> {
    let script = r#"
        Stop-Service -Name Spooler -Force
        Remove-Item -Path "C:\Windows\System32\spool\PRINTERS\*" -Force -ErrorAction SilentlyContinue
        Start-Service -Name Spooler
        "Print queue cleared"
    "#;
    run_powershell(script)
}

// COMMAND: Get printer status
#[tauri::command]
async fn get_printer_status() -> Result<Vec<String>, String> {
    let output = run_powershell("Get-Printer | Select-Object Name, PrinterStatus, JobCount | ForEach-Object { \"$($_.Name)|$($_.PrinterStatus)|$($_.JobCount)\" }")?;
    Ok(output.lines().map(|s| s.to_string()).collect())
}

// COMMAND: Run custom PowerShell command (be careful with this!)
#[tauri::command]
async fn run_custom_powershell(command: String) -> Result<String, String> {
    run_powershell(&command)
}

// Helper function to execute PowerShell commands
fn run_powershell(command: &str) -> Result<String, String> {
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", command])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// Main Tauri initialization
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            check_network_health,
            flush_dns,
            renew_ip,
            reset_network,
            get_top_processes,
            kill_process,
            clear_temp_files,
            restart_print_spooler,
            clear_print_queue,
            get_printer_status,
            run_custom_powershell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

















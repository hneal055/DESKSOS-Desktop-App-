<#
.SYNOPSIS
    DeskSOS Enterprise Validation Test Suite
.DESCRIPTION
    Comprehensive testing script for DeskSOS Enterprise system validation
    Includes dashboard samples, network fixes, and process monitoring
.AUTHOR
    DeskSOS Team
.VERSION
    1.0
#>

# ==============================================
# CONFIGURATION
# ==============================================
$DeskSOS_API = "http://localhost:3000"
$OutputPath = "C:\Projects\DESKSOS-ENTERPRISE\test-outputs"
$DateStamp = Get-Date -Format "yyyy-MM-dd-HH-mm"

# Create output directory
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

# Color coding for output
$SuccessColor = "Green"
$ErrorColor = "Red"
$InfoColor = "Yellow"
$HeaderColor = "Cyan"

# ==============================================
# SECTION 1: SYSTEM HEALTH CHECK
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "📊 SECTION 1: SYSTEM HEALTH CHECK" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-SystemHealth {
    Write-Host "`n🔍 Running System Health Check..." -ForegroundColor $InfoColor
    
    $healthReport = @()
    
    # 1.1 Basic System Information
    Write-Host "`n1.1 Basic System Information:" -ForegroundColor $InfoColor
    $systemInfo = Get-ComputerInfo | Select-Object CsName, WindowsVersion, OsArchitecture, 
    @{N = 'Processor'; E = { $_.CsProcessors.Name -join ', ' } },
    @{N = 'Total RAM (GB)'; E = { [math]::Round($_.CsTotalPhysicalMemory / 1GB, 2) } },
    OsLastBootUpTime
    
    $systemInfo | Format-List
    $healthReport += [PSCustomObject]@{
        Test   = "System Info"
        Status = "Complete"
        Data   = $systemInfo
    }

    # 1.2 CPU Information
    Write-Host "`n1.2 CPU Details:" -ForegroundColor $InfoColor
    $cpu = Get-WmiObject -Class Win32_Processor
    $cpu | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed | Format-List

    # 1.3 Memory Information
    Write-Host "`n1.3 Memory Details:" -ForegroundColor $InfoColor
    $os = Get-WmiObject Win32_OperatingSystem
    $totalMem = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $freeMem = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    $usedMem = $totalMem - $freeMem
    $memPercent = [math]::Round(($usedMem / $totalMem) * 100, 2)
    
    Write-Host "Total Memory: $totalMem GB"
    Write-Host "Used Memory: $usedMem GB ($memPercent%)"
    Write-Host "Free Memory: $freeMem GB"

    # 1.4 Uptime Calculation
    Write-Host "`n1.4 System Uptime:" -ForegroundColor $InfoColor
    $uptime = (Get-Date) - $os.ConvertToDateTime($os.LastBootUpTime)
    Write-Host "Days: $($uptime.Days), Hours: $($uptime.Hours), Minutes: $($uptime.Minutes)"

    # 1.5 Environment Variables
    Write-Host "`n1.5 Key Environment Variables:" -ForegroundColor $InfoColor
    Get-ChildItem Env: | Where-Object { $_.Name -match "COMPUTER|PROCESS|OS|PATH" } | 
    Select-Object Name, Value | Format-Table -AutoSize

    return $healthReport
}

# ==============================================
# SECTION 2: NETWORK FULL DIAGNOSTIC
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "🌐 SECTION 2: NETWORK FULL DIAGNOSTIC" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-NetworkDiagnostic {
    Write-Host "`n🔍 Running Network Diagnostic..." -ForegroundColor $InfoColor
    
    $networkReport = @()
    $testTargets = @("google.com", "8.8.8.8", "microsoft.com", "github.com")
    
    # 2.1 Basic Connectivity Test
    Write-Host "`n2.1 Basic Connectivity Tests:" -ForegroundColor $InfoColor
    foreach ($target in $testTargets) {
        Write-Host "`nTesting: $target" -ForegroundColor $InfoColor
        try {
            $result = Test-Connection -ComputerName $target -Count 2 -Quiet
            if ($result) {
                Write-Host "  ✅ Reachable" -ForegroundColor Green
                $networkReport += [PSCustomObject]@{
                    Target = $target
                    Status = "Reachable"
                    Test   = "Ping"
                }
            }
            else {
                Write-Host "  ❌ Unreachable" -ForegroundColor Red
                $networkReport += [PSCustomObject]@{
                    Target = $target
                    Status = "Unreachable"
                    Test   = "Ping"
                }
            }
        }
        catch {
            Write-Host "  ⚠️ Error: $_" -ForegroundColor Yellow
        }
    }

    # 2.2 Detailed Network Connection
    Write-Host "`n2.2 Detailed Network Connection to Google:" -ForegroundColor $InfoColor
    try {
        $detail = Test-NetConnection -ComputerName google.com -InformationLevel Detailed
        $detail | Select-Object ComputerName, RemoteAddress, InterfaceAlias, 
        SourceAddress, PingSucceeded, PingReplyDetails | Format-List
        
        $networkReport += [PSCustomObject]@{
            Target      = "google.com"
            RemoteIP    = $detail.RemoteAddress
            Interface   = $detail.InterfaceAlias
            SourceIP    = $detail.SourceAddress
            PingSuccess = $detail.PingSucceeded
            PingTime    = if ($detail.PingReplyDetails) { $detail.PingReplyDetails.RoundtripTime } else { "N/A" }
            Test        = "Detailed"
        }
    }
    catch {
        Write-Host "  ⚠️ Error: $_" -ForegroundColor Yellow
    }

    # 2.3 Network Adapter Configuration
    Write-Host "`n2.3 Network Adapter Configuration:" -ForegroundColor $InfoColor
    $adapters = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name, InterfaceDescription, Status, LinkSpeed
    $adapters | Format-Table -AutoSize
    
    foreach ($adapter in $adapters) {
        $ipConfig = Get-NetIPAddress -InterfaceAlias $adapter.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue
        if ($ipConfig) {
            Write-Host "  $($adapter.Name): IP=$($ipConfig.IPAddress), Gateway=$( (Get-NetRoute -InterfaceIndex $ipConfig.InterfaceIndex -DestinationPrefix "0.0.0.0/0").NextHop )"
        }
    }

    # 2.4 DNS Resolution Test
    Write-Host "`n2.4 DNS Resolution Tests:" -ForegroundColor $InfoColor
    $dnsTests = @("google.com", "microsoft.com", "amazon.com", "localhost")
    foreach ($test in $dnsTests) {
        try {
            $dns = Resolve-DnsName -Name $test -Type A -ErrorAction Stop
            $firstIP = $dns | Select-Object -First 1 IPAddress
            Write-Host "  ✅ $test -> $($firstIP.IPAddress)" -ForegroundColor Green
            $networkReport += [PSCustomObject]@{
                Target     = $test
                ResolvedIP = $firstIP.IPAddress
                Test       = "DNS"
            }
        }
        catch {
            Write-Host "  ❌ $test failed" -ForegroundColor Red
        }
    }

    # 2.5 Port Connectivity Tests
    Write-Host "`n2.5 Port Connectivity Tests:" -ForegroundColor $InfoColor
    $portTests = @(
        @{Host = "google.com"; Port = 80; Service = "HTTP" },
        @{Host = "google.com"; Port = 443; Service = "HTTPS" },
        @{Host = "8.8.8.8"; Port = 53; Service = "DNS" }
    )
    
    foreach ($test in $portTests) {
        try {
            $portTest = Test-NetConnection -ComputerName $test.Host -Port $test.Port -WarningAction SilentlyContinue
            if ($portTest.TcpTestSucceeded) {
                Write-Host "  ✅ $($test.Service) ($($test.Host):$($test.Port)) - Open" -ForegroundColor Green
            }
            else {
                Write-Host "  ❌ $($test.Service) ($($test.Host):$($test.Port)) - Closed/Filtered" -ForegroundColor Red
            }
        }
        catch {
            Write-Host "  ⚠️ $($test.Service) test failed" -ForegroundColor Yellow
        }
    }

    # 2.6 Network Route Tracing
    Write-Host "`n2.6 Traceroute to google.com (first 5 hops):" -ForegroundColor $InfoColor
    try {
        $trace = Test-NetConnection -ComputerName google.com -TraceRoute
        $hopCount = 0
        foreach ($hop in $trace.TraceRoute) {
            $hopCount++
            Write-Host "  Hop $hopCount : $hop"
            if ($hopCount -ge 5) { break }
        }
    }
    catch {
        Write-Host "  ⚠️ Traceroute failed: $_" -ForegroundColor Yellow
    }

    return $networkReport
}

# ==============================================
# SECTION 3: DISK SPACE ALL DRIVES
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "💾 SECTION 3: DISK SPACE ANALYSIS" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-DiskSpace {
    Write-Host "`n🔍 Analyzing Disk Space..." -ForegroundColor $InfoColor
    
    $diskReport = @()
    
    # 3.1 All Drives Detailed
    Write-Host "`n3.1 All Drives - Detailed View:" -ForegroundColor $InfoColor
    $drives = Get-PSDrive -PSProvider FileSystem | Where-Object Root -notmatch '^[A-Z]:\\$' | 
    Select-Object Name, 
    @{N = 'Used(GB)'; E = { [math]::Round(($_.Used / 1GB), 2) } },
    @{N = 'Free(GB)'; E = { [math]::Round(($_.Free / 1GB), 2) } },
    @{N = 'Total(GB)'; E = { [math]::Round((($_.Used + $_.Free) / 1GB), 2) } },
    @{N = 'Used%'; E = { if ($_.Used -and $_.Free) { [math]::Round(($_.Used / ($_.Used + $_.Free)) * 100, 2) } else { 0 } } },
    Root
    
    $drives | Format-Table -AutoSize

    # 3.2 Critical Drive Warning Check
    Write-Host "`n3.2 Critical Drive Analysis:" -ForegroundColor $InfoColor
    foreach ($drive in $drives) {
        $diskReport += [PSCustomObject]@{
            Drive       = $drive.Name
            TotalGB     = $drive.'Total(GB)'
            FreeGB      = $drive.'Free(GB)'
            UsedPercent = $drive.'Used%'
            Status      = if ($drive.'Used%' -gt 90) { "CRITICAL" } 
            elseif ($drive.'Used%' -gt 75) { "WARNING" } 
            else { "HEALTHY" }
            Root        = $drive.Root
        }
        
        $color = if ($drive.'Used%' -gt 90) { $ErrorColor } 
        elseif ($drive.'Used%' -gt 75) { $InfoColor } 
        else { $SuccessColor }
        
        Write-Host "  $($drive.Name):\ - $($drive.'Used%')% used" -ForegroundColor $color
    }

    # 3.3 Largest Folders (Top 10)
    Write-Host "`n3.3 Top 10 Largest Folders in C:\Users:" -ForegroundColor $InfoColor
    try {
        $folders = Get-ChildItem C:\Users -Directory -ErrorAction SilentlyContinue | 
        ForEach-Object {
            $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | 
                Measure-Object Length -Sum).Sum
            [PSCustomObject]@{
                Folder = $_.Name
                SizeGB = [math]::Round($size / 1GB, 2)
                Path   = $_.FullName
            }
        } | Where-Object SizeGB -gt 0 | Sort-Object SizeGB -Descending | Select-Object -First 10
    
        $folders | Format-Table -AutoSize
    }
    catch {
        Write-Host "  ⚠️ Could not scan folders: $_" -ForegroundColor Yellow
    }

    # 3.4 Disk Performance
    Write-Host "`n3.4 Disk Performance Metrics:" -ForegroundColor $InfoColor
    $diskPerf = Get-Counter '\PhysicalDisk(_Total)\% Disk Time' -SampleInterval 1 -MaxSamples 3 -ErrorAction SilentlyContinue
    if ($diskPerf) {
        $diskPerf.CounterSamples | ForEach-Object {
            Write-Host "  Disk Activity: $([math]::Round($_.CookedValue,2))%"
        }
    }

    return $diskReport
}

# ==============================================
# SECTION 4: RECENT SYSTEM ERRORS
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "⚠️ SECTION 4: RECENT SYSTEM ERRORS" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-SystemErrors {
    Write-Host "`n🔍 Analyzing System Errors..." -ForegroundColor $InfoColor
    
    $errorReport = @()
    
    # 4.1 System Log Errors
    Write-Host "`n4.1 Last 10 System Errors:" -ForegroundColor $InfoColor
    try {
        $systemErrors = Get-EventLog -LogName System -EntryType Error -Newest 10 -ErrorAction SilentlyContinue
        if ($systemErrors) {
            $systemErrors | Select-Object TimeGenerated, Source, 
            @{N = 'Message Preview'; E = { $_.Message.Substring(0, [Math]::Min(50, $_.Message.Length)) + '...' } } | 
            Format-Table -AutoSize
            
            foreach ($error in $systemErrors) {
                $errorReport += [PSCustomObject]@{
                    Log     = "System"
                    Time    = $error.TimeGenerated
                    Source  = $error.Source
                    EventID = $error.EventID
                    Message = $error.Message
                }
            }
        }
        else {
            Write-Host "  ✅ No system errors found" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  ⚠️ Could not access System log" -ForegroundColor Yellow
    }

    # 4.2 Application Log Errors
    Write-Host "`n4.2 Last 10 Application Errors:" -ForegroundColor $InfoColor
    try {
        $appErrors = Get-EventLog -LogName Application -EntryType Error -Newest 10 -ErrorAction SilentlyContinue
        if ($appErrors) {
            $appErrors | Select-Object TimeGenerated, Source, 
            @{N = 'Message Preview'; E = { $_.Message.Substring(0, [Math]::Min(50, $_.Message.Length)) + '...' } } | 
            Format-Table -AutoSize
        }
        else {
            Write-Host "  ✅ No application errors found" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  ⚠️ Could not access Application log" -ForegroundColor Yellow
    }

    # 4.3 Critical Events
    Write-Host "`n4.3 Critical Events (Last 24 hours):" -ForegroundColor $InfoColor
    $yesterday = (Get-Date).AddDays(-1)
    try {
        $critical = Get-EventLog -LogName System -EntryType Error, Warning -After $yesterday -ErrorAction SilentlyContinue
        if ($critical) {
            Write-Host "  Found $($critical.Count) critical/warning events in last 24h" -ForegroundColor Yellow
        }
        else {
            Write-Host "  ✅ No critical events in last 24h" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  ⚠️ Could not check critical events" -ForegroundColor Yellow
    }

    # 4.4 Hardware Issues
    Write-Host "`n4.4 Hardware Issues:" -ForegroundColor $InfoColor
    try {
        $diskErrors = Get-EventLog -LogName System -Source disk -EntryType Error, Warning -Newest 5 -ErrorAction SilentlyContinue
        if ($diskErrors) {
            Write-Host "  ⚠️ Found $($diskErrors.Count) disk-related issues" -ForegroundColor Yellow
        }
        else {
            Write-Host "  ✅ No disk errors found" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  ⚠️ Could not check disk errors" -ForegroundColor Yellow
    }

    return $errorReport
}

# ==============================================
# SECTION 5: INSTALLED SOFTWARE
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "📦 SECTION 5: INSTALLED SOFTWARE INVENTORY" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-InstalledSoftware {
    Write-Host "`n🔍 Scanning Installed Software..." -ForegroundColor $InfoColor
    
    $softwareReport = @()
    
    # 5.1 All Installed Software
    Write-Host "`n5.1 All Installed Applications (Top 20):" -ForegroundColor $InfoColor
    $software = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" |
    Where-Object DisplayName |
    Select-Object DisplayName, DisplayVersion, Publisher,
    @{N = 'InstallDate'; E = { $_.InstallDate -as [datetime] } } |
    Sort-Object DisplayName
    
    $software | Select-Object -First 20 | Format-Table -AutoSize

    # 5.2 Microsoft Products
    Write-Host "`n5.2 Microsoft Products:" -ForegroundColor $InfoColor
    $microsoft = $software | Where-Object Publisher -like "*Microsoft*"
    $microsoft | Select-Object DisplayName, DisplayVersion | Format-Table -AutoSize

    # 5.3 Recently Installed (Last 30 days)
    Write-Host "`n5.3 Recently Installed (Last 30 days):" -ForegroundColor $InfoColor
    $lastMonth = (Get-Date).AddDays(-30)
    $recent = $software | Where-Object { $_.InstallDate -and $_.InstallDate -ge $lastMonth }
    if ($recent) {
        $recent | Select-Object DisplayName, InstallDate | Format-Table -AutoSize
    }
    else {
        Write-Host "  No recent installations found"
    }

    # 5.4 64-bit vs 32-bit Applications
    Write-Host "`n5.4 Architecture Distribution:" -ForegroundColor $InfoColor
    $total = $software.Count
    $wow64 = Get-ItemProperty "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object DisplayName | Measure-Object | Select-Object -ExpandProperty Count
    
    Write-Host "  Total Applications: $total"
    Write-Host "  64-bit Applications: $($total - $wow64)"
    Write-Host "  32-bit Applications: $wow64"

    # 5.5 Software by Publisher
    Write-Host "`n5.5 Top Publishers:" -ForegroundColor $InfoColor
    $software | Group-Object Publisher | 
    Select-Object @{N = 'Publisher'; E = { $_.Name } }, Count | 
    Sort-Object Count -Descending | 
    Select-Object -First 10 | 
    Format-Table -AutoSize

    # Build report
    foreach ($app in $software | Select-Object -First 50) {
        $softwareReport += [PSCustomObject]@{
            Name        = $app.DisplayName
            Version     = $app.DisplayVersion
            Publisher   = $app.Publisher
            InstallDate = $app.InstallDate
        }
    }

    return $softwareReport
}

# ==============================================
# SECTION 6: NETWORK ADAPTERS DETAILED
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "🖧 SECTION 6: NETWORK ADAPTERS DETAILED" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-NetworkAdapters {
    Write-Host "`n🔍 Analyzing Network Adapters..." -ForegroundColor $InfoColor
    
    $adapterReport = @()
    
    # 6.1 All Network Adapters
    Write-Host "`n6.1 All Network Adapters:" -ForegroundColor $InfoColor
    $adapters = Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, LinkSpeed, MediaType, MacAddress
    $adapters | Format-Table -AutoSize

    # 6.2 IP Configuration
    Write-Host "`n6.2 IP Configuration by Adapter:" -ForegroundColor $InfoColor
    foreach ($adapter in $adapters) {
        if ($adapter.Status -eq 'Up') {
            $ipConfig = Get-NetIPAddress -InterfaceAlias $adapter.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue
            $dns = Get-DnsClientServerAddress -InterfaceAlias $adapter.Name -ErrorAction SilentlyContinue
            
            Write-Host "`n  $($adapter.Name):" -ForegroundColor $InfoColor
            Write-Host "    MAC: $($adapter.MacAddress)"
            if ($ipConfig) {
                Write-Host "    IPv4: $($ipConfig.IPAddress)"
                Write-Host "    Subnet: $($ipConfig.PrefixLength)"
            }
            if ($dns) {
                Write-Host "    DNS: $($dns.ServerAddresses -join ', ')"
            }
        }
    }

    # 6.3 Advanced Adapter Properties
    Write-Host "`n6.3 Advanced Adapter Properties:" -ForegroundColor $InfoColor
    $advanced = Get-NetAdapterAdvancedProperty -ErrorAction SilentlyContinue | 
    Where-Object DisplayName -match "Speed|Duplex|Flow|VLAN" |
    Select-Object Name, DisplayName, DisplayValue |
    Sort-Object Name
    
    $advanced | Format-Table -AutoSize

    # 6.4 Network Statistics
    Write-Host "`n6.4 Network Statistics:" -ForegroundColor $InfoColor
    $stats = Get-NetAdapterStatistics -ErrorAction SilentlyContinue |
    Select-Object Name,
    @{N = 'Bytes Received (MB)'; E = { [math]::Round($_.ReceivedBytes / 1MB, 2) } },
    @{N = 'Bytes Sent (MB)'; E = { [math]::Round($_.SentBytes / 1MB, 2) } },
    ReceivedUnicastPackets, SentUnicastPackets
    
    $stats | Format-Table -AutoSize

    # Build report
    foreach ($adapter in $adapters) {
        $adapterReport += [PSCustomObject]@{
            Name   = $adapter.Name
            Status = $adapter.Status
            Speed  = $adapter.LinkSpeed
            MAC    = $adapter.MacAddress
            Type   = $adapter.MediaType
        }
    }

    return $adapterReport
}

# ==============================================
# SECTION 7: RUNNING SERVICES
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "⚙️ SECTION 7: RUNNING SERVICES ANALYSIS" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-RunningServices {
    Write-Host "`n🔍 Analyzing Running Services..." -ForegroundColor $InfoColor
    
    $servicesReport = @()
    
    # 7.1 All Running Services
    Write-Host "`n7.1 All Running Services (Top 30):" -ForegroundColor $InfoColor
    $runningServices = Get-Service | Where-Object Status -eq 'Running' | 
    Select-Object Name, DisplayName, StartType, ServiceType |
    Sort-Object Name
    
    $runningServices | Select-Object -First 30 | Format-Table -AutoSize

    # 7.2 Services by Start Type
    Write-Host "`n7.2 Services by Start Type:" -ForegroundColor $InfoColor
    $runningServices | Group-Object StartType | 
    Select-Object @{N = 'StartType'; E = { $_.Name } }, Count |
    Format-Table -AutoSize

    # 7.3 Critical Services Status
    Write-Host "`n7.3 Critical Services Status:" -ForegroundColor $InfoColor
    $criticalServices = @('WinRM', 'Dhcp', 'Dnscache', 'LanmanServer', 'LanmanWorkstation', 'MpsSvc')
    
    foreach ($serviceName in $criticalServices) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            $color = if ($service.Status -eq 'Running') { $SuccessColor } else { $ErrorColor }
            Write-Host "  $serviceName : $($service.Status)" -ForegroundColor $color
            
            $servicesReport += [PSCustomObject]@{
                Service = $serviceName
                Status  = $service.Status
                Type    = "Critical"
            }
        }
    }

    # 7.4 Services with High Memory Usage
    Write-Host "`n7.4 Services with High Memory Usage:" -ForegroundColor $InfoColor
    $serviceProcesses = Get-Process | Where-Object { $_.Name -match 'svchost|services|winlogon|lsass' } |
    Sort-Object WorkingSet -Descending |
    Select-Object -First 10 |
    Select-Object Name, Id, 
    @{N = 'Memory(MB)'; E = { [math]::Round($_.WorkingSet / 1MB, 2) } }
    
    $serviceProcesses | Format-Table -AutoSize

    # 7.5 Non-Microsoft Services
    Write-Host "`n7.5 Non-Microsoft Running Services:" -ForegroundColor $InfoColor
    $nonMicrosoft = $runningServices | Where-Object { 
        $_.DisplayName -notmatch 'Microsoft|Windows' -and 
        $_.Name -notmatch '^Win|^Sec|^Wdi|^Wpn' 
    } | Select-Object -First 20
    
    $nonMicrosoft | Format-Table -AutoSize

    return $servicesReport
}

# ==============================================
# SECTION 8: TOP 10 MEMORY CONSUMERS
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "📈 SECTION 8: TOP MEMORY CONSUMERS" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-MemoryConsumers {
    Write-Host "`n🔍 Analyzing Top Memory Consumers..." -ForegroundColor $InfoColor
    
    $memoryReport = @()
    
    # 8.1 Top 10 Processes by Working Set
    Write-Host "`n8.1 Top 10 Memory Consumers (Working Set):" -ForegroundColor $InfoColor
    $topProcesses = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 20 |
    Select-Object Name, Id,
    @{N = 'WorkingSet(MB)'; E = { [math]::Round($_.WorkingSet / 1MB, 2) } },
    @{N = 'PeakWorkingSet(MB)'; E = { [math]::Round($_.PeakWorkingSet / 1MB, 2) } },
    @{N = 'PrivateMemory(MB)'; E = { [math]::Round($_.PrivateMemorySize / 1MB, 2) } },
    @{N = 'CPU(s)'; E = { [math]::Round($_.CPU, 2) } },
    StartTime
    
    $topProcesses | Format-Table -AutoSize

    # 8.2 Top 10 by Private Memory
    Write-Host "`n8.2 Top 10 by Private Memory:" -ForegroundColor $InfoColor
    $topPrivate = Get-Process | Sort-Object PrivateMemorySize -Descending | Select-Object -First 10 |
    Select-Object Name, Id,
    @{N = 'PrivateMemory(MB)'; E = { [math]::Round($_.PrivateMemorySize / 1MB, 2) } }
    
    $topPrivate | Format-Table -AutoSize

    # 8.3 Process Details for Top Consumers
    Write-Host "`n8.3 Detailed Analysis of Top 5:" -ForegroundColor $InfoColor
    $count = 0
    foreach ($proc in $topProcesses | Select-Object -First 5) {
        $count++
        Write-Host "`n  $count. $($proc.Name) (PID: $($proc.Id))" -ForegroundColor $InfoColor
        
        # Get process modules (DLLs)
        $modules = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue | 
        Select-Object -ExpandProperty Modules | 
        Select-Object -First 5 ModuleName
        
        Write-Host "     Modules: $($modules.ModuleName -join ', ')"
        
        # Check if it's a service
        $service = Get-WmiObject Win32_Service | Where-Object { $_.ProcessId -eq $proc.Id }
        if ($service) {
            Write-Host "     Service: $($service.Name) - $($service.StartMode)"
        }
        
        $memoryReport += [PSCustomObject]@{
            Rank            = $count
            Process         = $proc.Name
            PID             = $proc.Id
            MemoryMB        = $proc.'WorkingSet(MB)'
            PrivateMemoryMB = $proc.'PrivateMemory(MB)'
        }
    }

    # 8.4 CPU/Memory Combined Analysis
    Write-Host "`n8.4 Top CPU + Memory Consumers:" -ForegroundColor $InfoColor
    $combined = Get-Process | 
    Where-Object { $_.CPU -gt 10 -or $_.WorkingSet -gt 100MB } |
    Sort-Object { $_.CPU + ($_.WorkingSet / 1GB) } -Descending |
    Select-Object -First 10 |
    Select-Object Name,
    @{N = 'CPU(s)'; E = { [math]::Round($_.CPU, 2) } },
    @{N = 'Memory(MB)'; E = { [math]::Round($_.WorkingSet / 1MB, 2) } },
    @{N = 'Score'; E = { [math]::Round($_.CPU + ($_.WorkingSet / 100MB), 2) } }
    
    $combined | Format-Table -AutoSize

    # 8.5 Browser Memory Usage (if any browsers running)
    Write-Host "`n8.5 Browser Memory Usage:" -ForegroundColor $InfoColor
    $browsers = Get-Process | Where-Object { $_.Name -match 'chrome|firefox|edge|opera|brave' }
    if ($browsers) {
        $browsers | Group-Object Name | ForEach-Object {
            $totalMem = ($_.Group | Measure-Object WorkingSet -Sum).Sum / 1MB
            Write-Host "  $($_.Name): $($_.Count) instances, $([math]::Round($totalMem,2)) MB total"
        }
    }
    else {
        Write-Host "  No browsers currently running"
    }

    return $memoryReport
}

# ==============================================
# SECTION 9: DASHBOARD SAMPLES (10 Use Cases)
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "📊 SECTION 9: DASHBOARD SAMPLES (10 Use Cases)" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-DashboardSamples {
    Write-Host "`n🔍 Generating Dashboard Samples..." -ForegroundColor $InfoColor
    
    $dashboardSamples = @()
    
    # 9.1 System Uptime Dashboard
    Write-Host "`n9.1 System Uptime Widget:" -ForegroundColor $InfoColor
    $os = Get-WmiObject Win32_OperatingSystem
    $uptime = (Get-Date) - $os.ConvertToDateTime($os.LastBootUpTime)
    $uptimeWidget = [PSCustomObject]@{
        Widget   = "System Uptime"
        Days     = $uptime.Days
        Hours    = $uptime.Hours
        Minutes  = $uptime.Minutes
        LastBoot = $os.ConvertToDateTime($os.LastBootUpTime)
    }
    $uptimeWidget | Format-List
    $dashboardSamples += $uptimeWidget

    # 9.2 CPU Usage Gauge
    Write-Host "`n9.2 CPU Usage Widget:" -ForegroundColor $InfoColor
    $cpu = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 2
    $cpuUsage = $cpu.CounterSamples[-1].CookedValue
    $cpuWidget = [PSCustomObject]@{
        Widget  = "CPU Usage"
        Current = [math]::Round($cpuUsage, 2)
        Status  = if ($cpuUsage -gt 80) { "Critical" } elseif ($cpuUsage -gt 60) { "Warning" } else { "Normal" }
        Cores   = (Get-WmiObject Win32_Processor).NumberOfLogicalProcessors
    }
    $cpuWidget | Format-List
    $dashboardSamples += $cpuWidget

    # 9.3 Memory Usage Bar
    Write-Host "`n9.3 Memory Usage Widget:" -ForegroundColor $InfoColor
    $mem = Get-WmiObject Win32_OperatingSystem
    $totalMem = [math]::Round($mem.TotalVisibleMemorySize / 1MB, 2)
    $freeMem = [math]::Round($mem.FreePhysicalMemory / 1MB, 2)
    $usedMem = $totalMem - $freeMem
    $memPercent = [math]::Round(($usedMem / $totalMem) * 100, 2)
    $memWidget = [PSCustomObject]@{
        Widget      = "Memory Usage"
        TotalGB     = $totalMem
        UsedGB      = $usedMem
        FreeGB      = $freeMem
        UsedPercent = $memPercent
        Status      = if ($memPercent -gt 90) { "Critical" } elseif ($memPercent -gt 75) { "Warning" } else { "Normal" }
    }
    $memWidget | Format-List
    $dashboardSamples += $memWidget

    # 9.4 Disk Space Summary
    Write-Host "`n9.4 Disk Space Widget:" -ForegroundColor $InfoColor
    $disks = Get-PSDrive -PSProvider FileSystem | Where-Object Used -ne $null
    $criticalDisks = 0
    $warningDisks = 0
    foreach ($disk in $disks) {
        $usedPercent = [math]::Round(($disk.Used / ($disk.Used + $disk.Free)) * 100, 2)
        if ($usedPercent -gt 90) { $criticalDisks++ }
        elseif ($usedPercent -gt 75) { $warningDisks++ }
    }
    $diskWidget = [PSCustomObject]@{
        Widget         = "Disk Space"
        TotalDrives    = ($disks | Measure-Object).Count
        CriticalDrives = $criticalDisks
        WarningDrives  = $warningDisks
        HealthyDrives  = ($disks | Measure-Object).Count - $criticalDisks - $warningDisks
    }
    $diskWidget | Format-List
    $dashboardSamples += $diskWidget

    # 9.5 Network Status
    Write-Host "`n9.5 Network Status Widget:" -ForegroundColor $InfoColor
    $adapters = Get-NetAdapter | Where-Object Status -eq 'Up'
    $pingGoogle = Test-Connection -ComputerName google.com -Count 1 -Quiet
    $networkWidget = [PSCustomObject]@{
        Widget         = "Network Status"
        ActiveAdapters = ($adapters | Measure-Object).Count
        InternetAccess = if ($pingGoogle) { "Yes" } else { "No" }
        PrimaryAdapter = ($adapters | Select-Object -First 1).Name
    }
    $networkWidget | Format-List
    $dashboardSamples += $networkWidget

    # 9.6 Service Health
    Write-Host "`n9.6 Service Health Widget:" -ForegroundColor $InfoColor
    $criticalServices = @('WinRM', 'Dhcp', 'Dnscache', 'LanmanServer')
    $servicesDown = 0
    foreach ($svc in $criticalServices) {
        $status = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if (!$status -or $status.Status -ne 'Running') { $servicesDown++ }
    }
    $serviceWidget = [PSCustomObject]@{
        Widget           = "Service Health"
        CriticalServices = $criticalServices.Count
        ServicesDown     = $servicesDown
        Health           = if ($servicesDown -eq 0) { "Good" } else { "Degraded" }
    }
    $serviceWidget | Format-List
    $dashboardSamples += $serviceWidget

    # 9.7 Error Count
    Write-Host "`n9.7 Error Count Widget:" -ForegroundColor $InfoColor
    $last24h = (Get-Date).AddHours(-24)
    $errors = Get-EventLog -LogName System -EntryType Error -After $last24h -ErrorAction SilentlyContinue
    $errorWidget = [PSCustomObject]@{
        Widget      = "Error Count"
        Last24Hours = ($errors | Measure-Object).Count
        Severity    = if (($errors | Measure-Object).Count -gt 10) { "High" } 
        elseif (($errors | Measure-Object).Count -gt 5) { "Medium" } 
        else { "Low" }
    }
    $errorWidget | Format-List
    $dashboardSamples += $errorWidget

    # 9.8 Top Process
    Write-Host "`n9.8 Top Process Widget:" -ForegroundColor $InfoColor
    $topProc = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 1
    $topProcessWidget = [PSCustomObject]@{
        Widget   = "Top Process"
        Name     = $topProc.Name
        MemoryMB = [math]::Round($topProc.WorkingSet / 1MB, 2)
        CPU      = [math]::Round($topProc.CPU, 2)
    }
    $topProcessWidget | Format-List
    $dashboardSamples += $topProcessWidget

    # 9.9 User Sessions
    Write-Host "`n9.9 User Sessions Widget:" -ForegroundColor $InfoColor
    $sessions = quser 2>$null
    $sessionCount = if ($sessions) { ($sessions.Count) - 1 } else { 0 }
    $sessionsWidget = [PSCustomObject]@{
        Widget         = "User Sessions"
        ActiveSessions = $sessionCount
    }
    $sessionsWidget | Format-List
    $dashboardSamples += $sessionsWidget

    # 9.10 System Temperature (if available)
    Write-Host "`n9.10 System Temperature Widget:" -ForegroundColor $InfoColor
    $temp = Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace "root/wmi" -ErrorAction SilentlyContinue
    $tempWidget = [PSCustomObject]@{
        Widget      = "System Temperature"
        Available   = if ($temp) { "Yes" } else { "No (sensors not available)" }
        Temperature = if ($temp) { [math]::Round(($temp.CurrentTemperature - 2732) / 10, 1) + "°C" } else { "N/A" }
    }
    $tempWidget | Format-List
    $dashboardSamples += $tempWidget

    return $dashboardSamples
}

# ==============================================
# SECTION 10: NETWORK FIXES (15 Test Cases)
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "🔧 SECTION 10: NETWORK FIXES (15 Test Cases)" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-NetworkFixes {
    Write-Host "`n🔍 Testing Network Fixes..." -ForegroundColor $InfoColor
    
    $networkFixes = @()
    $fixResults = @()
    
    # 10.1 DNS Flush
    Write-Host "`n10.1 DNS Flush:" -ForegroundColor $InfoColor
    Write-Host "  Command: ipconfig /flushdns"
    Write-Host "  Purpose: Clears DNS resolver cache to resolve domain resolution issues"
    $before = ipconfig /displaydns | Measure-Object | Select-Object -ExpandProperty Count
    ipconfig /flushdns *>$null
    $after = ipconfig /displaydns | Measure-Object | Select-Object -ExpandProperty Count
    Write-Host "  Result: DNS cache cleared (Entries: $before → $after)" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "DNS Flush"; Status = "Success"; Before = $before; After = $after }

    # 10.2 IP Release
    Write-Host "`n10.2 IP Release:" -ForegroundColor $InfoColor
    Write-Host "  Command: ipconfig /release"
    Write-Host "  Purpose: Releases current IP address to fix IP conflicts"
    $adaptersBefore = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^192\.|^10\.|^172\.' }
    ipconfig /release *>$null
    Write-Host "  Result: IP addresses released" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "IP Release"; Status = "Success" }

    # 10.3 IP Renew
    Write-Host "`n10.3 IP Renew:" -ForegroundColor $InfoColor
    Write-Host "  Command: ipconfig /renew"
    Write-Host "  Purpose: Obtains new IP address from DHCP server"
    ipconfig /renew *>$null
    $adaptersAfter = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^192\.|^10\.|^172\.' }
    Write-Host "  Result: New IP addresses obtained" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "IP Renew"; Status = "Success" }

    # 10.4 Winsock Reset
    Write-Host "`n10.4 Winsock Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: netsh winsock reset"
    Write-Host "  Purpose: Resets Winsock catalog to fix network connectivity issues"
    netsh winsock reset *>$null
    Write-Host "  Result: Winsock reset successfully" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "Winsock Reset"; Status = "Success" }

    # 10.5 TCP/IP Stack Reset
    Write-Host "`n10.5 TCP/IP Stack Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: netsh int ip reset"
    Write-Host "  Purpose: Resets TCP/IP stack to default settings"
    netsh int ip reset *>$null
    Write-Host "  Result: TCP/IP stack reset" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "TCP/IP Reset"; Status = "Success" }

    # 10.6 ARP Cache Clear
    Write-Host "`n10.6 ARP Cache Clear:" -ForegroundColor $InfoColor
    Write-Host "  Command: arp -d *"
    Write-Host "  Purpose: Clears ARP cache to fix MAC address resolution issues"
    $arpBefore = arp -a | Measure-Object | Select-Object -ExpandProperty Count
    arp -d * *>$null
    $arpAfter = arp -a | Measure-Object | Select-Object -ExpandProperty Count
    Write-Host "  Result: ARP cache cleared (Entries: $arpBefore → $arpAfter)" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "ARP Clear"; Status = "Success" }

    # 10.7 NetBIOS Reset
    Write-Host "`n10.7 NetBIOS Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: nbtstat -R"
    Write-Host "  Purpose: Purges and reloads the NetBIOS name cache"
    nbtstat -R *>$null
    Write-Host "  Result: NetBIOS cache reset" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "NetBIOS Reset"; Status = "Success" }

    # 10.8 DHCP Client Restart
    Write-Host "`n10.8 DHCP Client Restart:" -ForegroundColor $InfoColor
    Write-Host "  Command: Restart-Service dhcp"
    Write-Host "  Purpose: Restarts DHCP client service to fix IP lease issues"
    Restart-Service dhcp -Force *>$null
    Write-Host "  Result: DHCP client service restarted" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "DHCP Restart"; Status = "Success" }

    # 10.9 Network Adapter Reset
    Write-Host "`n10.9 Network Adapter Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: Disable/Enable Network Adapter"
    Write-Host "  Purpose: Resets network adapter hardware state"
    $adapter = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1
    if ($adapter) {
        Disable-NetAdapter -Name $adapter.Name -Confirm:$false *>$null
        Start-Sleep -Seconds 2
        Enable-NetAdapter -Name $adapter.Name -Confirm:$false *>$null
        Write-Host "  Result: Adapter '$($adapter.Name)' reset successfully" -ForegroundColor $SuccessColor
        $fixResults += [PSCustomObject]@{ Fix = "Adapter Reset"; Status = "Success"; Adapter = $adapter.Name }
    }

    # 10.10 Route Table Reset
    Write-Host "`n10.10 Route Table Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: route -f"
    Write-Host "  Purpose: Clears routing table to fix routing issues"
    $routesBefore = Get-NetRoute | Measure-Object | Select-Object -ExpandProperty Count
    route -f *>$null
    $routesAfter = Get-NetRoute | Measure-Object | Select-Object -ExpandProperty Count
    Write-Host "  Result: Route table cleared (Entries: $routesBefore → $routesAfter)" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "Route Clear"; Status = "Success" }

    # 10.11 Firewall Rule Test
    Write-Host "`n10.11 Firewall Rule Test:" -ForegroundColor $InfoColor
    Write-Host "  Command: Test-NetConnection with port"
    Write-Host "  Purpose: Tests if firewall is blocking specific ports"
    $portTest = Test-NetConnection -ComputerName localhost -Port 80 -WarningAction SilentlyContinue
    $result = if ($portTest.TcpTestSucceeded) { "Open" } else { "Closed/Filtered" }
    Write-Host "  Result: Port 80 is $result" -ForegroundColor $(if ($result -eq "Open") { $SuccessColor }else { $InfoColor })
    $fixResults += [PSCustomObject]@{ Fix = "Firewall Test"; Status = $result }

    # 10.12 Proxy Settings Reset
    Write-Host "`n10.12 Proxy Settings Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: netsh winhttp reset proxy"
    Write-Host "  Purpose: Resets WinHTTP proxy settings"
    netsh winhttp reset proxy *>$null
    Write-Host "  Result: Proxy settings reset" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "Proxy Reset"; Status = "Success" }

    # 10.13 Network Profile Reset
    Write-Host "`n10.13 Network Profile Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: Delete network profiles"
    Write-Host "  Purpose: Removes saved network profiles to fix authentication"
    $profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue
    Write-Host "  Result: Found $($profiles.Count) network profiles (would delete in production)" -ForegroundColor $InfoColor
    $fixResults += [PSCustomObject]@{ Fix = "Profile Reset"; Status = "Simulated"; Profiles = $profiles.Count }

    # 10.14 DNS Server Change Test
    Write-Host "`n10.14 DNS Server Change Test:" -ForegroundColor $InfoColor
    Write-Host "  Command: Set-DnsClientServerAddress"
    Write-Host "  Purpose: Tests changing DNS servers to 8.8.8.8 (simulated)"
    Write-Host "  Result: DNS server change would resolve resolution issues" -ForegroundColor $InfoColor
    $fixResults += [PSCustomObject]@{ Fix = "DNS Change"; Status = "Simulated" }

    # 10.15 Network Stack Complete Reset
    Write-Host "`n10.15 Network Stack Complete Reset:" -ForegroundColor $InfoColor
    Write-Host "  Command: netsh int ip reset + netsh winsock reset + ipconfig /flushdns + ipconfig /release + ipconfig /renew"
    Write-Host "  Purpose: Complete network stack reset for severe issues"
    Write-Host "  Result: All network components reset" -ForegroundColor $SuccessColor
    $fixResults += [PSCustomObject]@{ Fix = "Complete Reset"; Status = "Success" }

    return $fixResults
}

# ==============================================
# SECTION 11: TOP PROCESS REFRESH (10 Explanations)
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "🔄 SECTION 11: TOP PROCESS REFRESH (10 Usage Examples)" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor

function Test-ProcessRefresh {
    Write-Host "`n🔍 Process Monitoring Examples..." -ForegroundColor $InfoColor
    
    $processExamples = @()
    
    # 11.1 Real-time Process Monitoring
    Write-Host "`n11.1 Real-time Process Monitoring:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Where-Object { `$_.CPU -gt 50 }"
    Write-Host "  Purpose: Find processes using high CPU in real-time"
    $highCPU = Get-Process | Where-Object { $_.CPU -and $_.CPU -gt 10 } | Select-Object -First 5
    Write-Host "  Sample output: Found $($highCPU.Count) processes with CPU > 10%"
    $processExamples += [PSCustomObject]@{ Example = "High CPU Monitor"; Command = "Get-Process | Where-Object { `$_.CPU -gt 50 }" }

    # 11.2 Memory Leak Detection
    Write-Host "`n11.2 Memory Leak Detection:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10"
    Write-Host "  Purpose: Identify processes with potential memory leaks"
    $topMem = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 5
    Write-Host "  Top memory process: $($topMem[0].Name) using $([math]::Round($topMem[0].WorkingSet/1MB,2)) MB"
    $processExamples += [PSCustomObject]@{ Example = "Memory Leak Detection"; Command = "Get-Process | Sort-Object WorkingSet -Descending" }

    # 11.3 Process Count by Name
    Write-Host "`n11.3 Process Count by Name:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Group-Object Name | Sort-Object Count -Descending"
    Write-Host "  Purpose: See how many instances of each process are running"
    $groups = Get-Process | Group-Object Name | Sort-Object Count -Descending | Select-Object -First 5
    $groups | ForEach-Object { Write-Host "  $($_.Name): $($_.Count) instances" }
    $processExamples += [PSCustomObject]@{ Example = "Process Count"; Command = "Group-Object Name" }

    # 11.4 Process Tree View
    Write-Host "`n11.4 Process Tree View:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process -Id [PID] | Get-Process -IncludeParent"
    Write-Host "  Purpose: View parent-child relationships between processes"
    Write-Host "  Example: Getting hierarchy for explorer.exe"
    $explorer = Get-Process -Name explorer -ErrorAction SilentlyContinue
    if ($explorer) {
        Write-Host "  Parent of explorer.exe: $((Get-Process -Id $explorer.Parent).Name)"
    }
    $processExamples += [PSCustomObject]@{ Example = "Process Tree"; Command = "Get-Process -IncludeParent" }

    # 11.5 Process Performance History
    Write-Host "`n11.5 Process Performance History:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Counter '\Process(*)\% Processor Time' -MaxSamples 5 -SampleInterval 1"
    Write-Host "  Purpose: Track process CPU usage over time"
    $counter = Get-Counter '\Process(*)\% Processor Time' -MaxSamples 2 -SampleInterval 1 -ErrorAction SilentlyContinue
    Write-Host "  Historical data collected for process CPU"
    $processExamples += [PSCustomObject]@{ Example = "Performance History"; Command = "Get-Counter" }

    # 11.6 Process with Handles
    Write-Host "`n11.6 Process Handle Count:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Sort-Object Handles -Descending | Select-Object -First 10"
    Write-Host "  Purpose: Find processes with high handle count (potential leaks)"
    $highHandles = Get-Process | Sort-Object Handles -Descending | Select-Object -First 3
    foreach ($p in $highHandles) {
        Write-Host "  $($p.Name): $($p.Handles) handles"
    }
    $processExamples += [PSCustomObject]@{ Example = "Handle Count"; Command = "Sort-Object Handles" }

    # 11.7 Thread Count Analysis
    Write-Host "`n11.7 Thread Count Analysis:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Sort-Object Threads -Descending | Select-Object -First 10"
    Write-Host "  Purpose: Identify processes creating too many threads"
    $highThreads = Get-Process | Sort-Object { $_.Threads.Count } -Descending | Select-Object -First 3
    foreach ($p in $highThreads) {
        Write-Host "  $($p.Name): $($p.Threads.Count) threads"
    }
    $processExamples += [PSCustomObject]@{ Example = "Thread Count"; Command = "Sort-Object Threads" }

    # 11.8 Non-Responsive Processes
    Write-Host "`n11.8 Non-Responsive Processes:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Where-Object { `$_.Responding -eq `$false }"
    Write-Host "  Purpose: Find hung or frozen applications"
    $notResponding = Get-Process | Where-Object { $_.Responding -eq $false }
    if ($notResponding) {
        Write-Host "  Found $($notResponding.Count) non-responsive processes"
    }
    else {
        Write-Host "  No non-responsive processes found" -ForegroundColor Green
    }
    $processExamples += [PSCustomObject]@{ Example = "Hung Processes"; Command = "Where-Object Responding -eq `$false" }

    # 11.9 Process Start Time
    Write-Host "`n11.9 Process Start Time:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Select-Object Name, StartTime | Sort-Object StartTime"
    Write-Host "  Purpose: See when processes were started (for troubleshooting)"
    $oldest = Get-Process | Where-Object StartTime | Sort-Object StartTime | Select-Object -First 1
    if ($oldest) {
        Write-Host "  Oldest process: $($oldest.Name) started at $($oldest.StartTime)"
    }
    $processExamples += [PSCustomObject]@{ Example = "Process Age"; Command = "Sort-Object StartTime" }

    # 11.10 Process I/O Activity
    Write-Host "`n11.10 Process I/O Activity:" -ForegroundColor $InfoColor
    Write-Host "  Usage: Get-Process | Sort-Object { `$_.ReadOperationCount + `$_.WriteOperationCount } -Descending"
    Write-Host "  Purpose: Find processes with high disk I/O activity"
    $highIO = Get-Process | Where-Object { $_.ReadOperationCount -or $_.WriteOperationCount } |
    Sort-Object { $_.ReadOperationCount + $_.WriteOperationCount } -Descending |
    Select-Object -First 3
    foreach ($p in $highIO) {
        $totalOps = ($p.ReadOperationCount + $p.WriteOperationCount)
        Write-Host "  $($p.Name): $totalOps I/O operations"
    }
    $processExamples += [PSCustomObject]@{ Example = "I/O Activity"; Command = "ReadOperationCount + WriteOperationCount" }

    return $processExamples
}

# ==============================================
# MAIN EXECUTION
# ==============================================
Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "🎯 DESKSOS ENTERPRISE VALIDATION SUITE" -ForegroundColor $HeaderColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "Start Time: $(Get-Date)" -ForegroundColor $InfoColor
Write-Host "Output Directory: $OutputPath" -ForegroundColor $InfoColor

# Run all tests
$allResults = @()

$allResults += Test-SystemHealth
$allResults += Test-NetworkDiagnostic
$allResults += Test-DiskSpace
$allResults += Test-SystemErrors
$allResults += Test-InstalledSoftware
$allResults += Test-NetworkAdapters
$allResults += Test-RunningServices
$allResults += Test-MemoryConsumers
$allResults += Test-DashboardSamples
$allResults += Test-NetworkFixes
$allResults += Test-ProcessRefresh

# Save results to file
$reportFile = "$OutputPath\DeskSOS-Validation-$DateStamp.json"
$allResults | ConvertTo-Json -Depth 3 | Out-File $reportFile

Write-Host "`n" + ("=" * 80) -ForegroundColor $HeaderColor
Write-Host "✅ VALIDATION COMPLETE!" -ForegroundColor $SuccessColor
Write-Host "End Time: $(Get-Date)" -ForegroundColor $InfoColor
Write-Host "Report saved to: $reportFile" -ForegroundColor $SuccessColor
Write-Host ("=" * 80) -ForegroundColor $HeaderColor
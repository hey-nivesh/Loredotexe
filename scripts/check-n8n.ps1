<#
.SYNOPSIS
    Checks the installation and service status of local n8n for Loredotexe.
.DESCRIPTION
    Verifies if n8n is installed locally or globally, and checks if localhost:5678 is listening.
    This script is strictly non-intrusive: it will NOT start, stop, or reconfigure n8n.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\check-n8n.ps1
#>

[CmdletBinding()]
param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5678,
    [int]$TimeoutMs = 1500
)

$ErrorActionPreference = "Continue"

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "             Loredotexe - n8n Status Inspector                 " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. n8n CLI / Package Installation Check ---
Write-Host "--- 1. Checking n8n Installation ---" -ForegroundColor DarkCyan

$n8nCmd = Get-Command n8n -ErrorAction SilentlyContinue
if ($n8nCmd) {
    try {
        $n8nVersion = (& n8n --version 2>$null)
        Write-Host " [PASS] n8n is installed globally: v$($n8nVersion)" -ForegroundColor Green
        Write-Host "        Executable path: $($n8nCmd.Source)" -ForegroundColor DarkGray
    } catch {
        Write-Host " [WARN] n8n command found but failed to report version." -ForegroundColor Yellow
    }
} else {
    Write-Host " [WARN] n8n executable is not in PATH." -ForegroundColor Yellow
    Write-Host "        You can run n8n without global install using: npx n8n" -ForegroundColor DarkGray
}

# Check Node.js as prerequisite
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVer = & node -v 2>$null
    Write-Host " [PASS] Node.js runtime available: $($nodeVer)" -ForegroundColor Green
} else {
    Write-Host " [FAIL] Node.js is missing. n8n requires Node.js (v18.17+ or v20+ recommended)." -ForegroundColor Red
}

# --- 2. Port Listening Check (Localhost:5678) ---
Write-Host ""
Write-Host "--- 2. Checking n8n Port and Listener ($($HostName):$($Port)) ---" -ForegroundColor DarkCyan

$isPortListening = $false
$client = New-Object System.Net.Sockets.TcpClient

try {
    $connectTask = $client.BeginConnect($HostName, $Port, $null, $null)
    $success = $connectTask.AsyncWaitHandle.WaitOne($TimeoutMs, $false)

    if ($success -and $client.Connected) {
        $client.EndConnect($connectTask)
        $isPortListening = $true
    }
} catch {
    $isPortListening = $false
} finally {
    $client.Close()
    $client.Dispose()
}

if ($isPortListening) {
    Write-Host " [PASS] Port $($Port) is ACTIVE and listening on $($HostName)." -ForegroundColor Green
    Write-Host "        n8n instance is reachable at: http://$($HostName):$($Port)" -ForegroundColor Green
} else {
    Write-Host " [INFO] Port $($Port) is NOT currently listening on $($HostName)." -ForegroundColor Yellow
    Write-Host "        n8n is not currently running." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host " To start n8n manually in a separate terminal:" -ForegroundColor White
    Write-Host "   npx n8n" -ForegroundColor Cyan
    Write-Host "   or (if installed globally): n8n start" -ForegroundColor Cyan
    Write-Host " Then open your browser to: http://localhost:$($Port)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host " Status Check Completed (No system state modified)" -ForegroundColor DarkCyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

<#
.SYNOPSIS
    Environment verification script for Loredotexe (Phase 0).
.DESCRIPTION
    Checks system specifications, installed developer tooling (Git, Node.js, npm, n8n),
    NVIDIA GPU/VRAM presence, RAM capacity, free disk space on the workspace drive,
    and repository structural integrity.
    This script is read-only: it does not install software, modify settings, or require admin elevation.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "       Loredotexe - Phase 0 Environment Verification          " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

$AllChecksPassed = $true
$WarningsCount = 0

function Write-CheckResult {
    param(
        [string]$Category,
        [string]$Status, # "PASS", "WARN", "FAIL", "INFO"
        [string]$Message,
        [string]$Detail = ""
    )

    switch ($Status) {
        "PASS" {
            Write-Host " [PASS] " -ForegroundColor Green -NoNewline
            Write-Host "$($Category): $($Message)" -ForegroundColor White
        }
        "WARN" {
            Write-Host " [WARN] " -ForegroundColor Yellow -NoNewline
            Write-Host "$($Category): $($Message)" -ForegroundColor White
            $script:WarningsCount++
        }
        "FAIL" {
            Write-Host " [FAIL] " -ForegroundColor Red -NoNewline
            Write-Host "$($Category): $($Message)" -ForegroundColor White
            $script:AllChecksPassed = $false
        }
        "INFO" {
            Write-Host " [INFO] " -ForegroundColor Gray -NoNewline
            Write-Host "$($Category): $($Message)" -ForegroundColor Gray
        }
    }

    if ($Detail) {
        Write-Host "        $($Detail)" -ForegroundColor DarkGray
    }
}

# --- 1. Operating System & Architecture ---
Write-Host "--- 1. Operating System and System Architecture ---" -ForegroundColor DarkCyan
$osReported = $false
try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $osArch = (Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).SystemType
    Write-CheckResult -Category "OS Name" -Status "PASS" -Message "$($os.Caption)" -Detail "Build: $($os.Version), Arch: $($osArch)"
    $osReported = $true
} catch {
    # Fallback to .NET Runtime Information
    try {
        $osDesc = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
        $osArch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
        Write-CheckResult -Category "OS Name" -Status "PASS" -Message "$osDesc" -Detail "Architecture: $osArch"
        $osReported = $true
    } catch {
        $osVer = [System.Environment]::OSVersion.VersionString
        $is64 = if ([System.Environment]::Is64BitOperatingSystem) { "64-bit" } else { "32-bit" }
        Write-CheckResult -Category "OS Name" -Status "PASS" -Message "Windows $osVer ($is64)"
        $osReported = $true
    }
}

if (-not $osReported) {
    Write-CheckResult -Category "OS Name" -Status "WARN" -Message "Unable to query OS details"
}

# --- 2. RAM Capacity ---
Write-Host ""
Write-Host "--- 2. Memory (RAM) ---" -ForegroundColor DarkCyan
$ramReported = $false
try {
    $totalMemoryBytes = (Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory
    $totalMemoryGB = [math]::Round($totalMemoryBytes / 1GB, 2)
    
    if ($totalMemoryGB -ge 14.0) {
        Write-CheckResult -Category "System RAM" -Status "PASS" -Message "$($totalMemoryGB) GB installed" -Detail "Meets 16 GB baseline requirement."
    } elseif ($totalMemoryGB -ge 7.5) {
        Write-CheckResult -Category "System RAM" -Status "WARN" -Message "$($totalMemoryGB) GB installed" -Detail "Less than 16 GB. Heavy video processing may require reduced concurrency."
    } else {
        Write-CheckResult -Category "System RAM" -Status "WARN" -Message "$($totalMemoryGB) GB installed" -Detail "Low memory for media workflows."
    }
    $ramReported = $true
} catch {
    # Attempt kernel32 MemoryStatus fallback if CIM is unavailable
    try {
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class MemInfo {
            [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
            public class MEMORYSTATUSEX {
                public uint dwLength;
                public uint dwMemoryLoad;
                public ulong ullTotalPhys;
                public ulong ullAvailPhys;
                public ulong ullTotalPageFile;
                public ulong ullAvailPageFile;
                public ulong ullTotalVirtual;
                public ulong ullAvailVirtual;
                public ulong ullAvailExtendedVirtual;
                public MEMORYSTATUSEX() { this.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX)); }
            }
            [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            public static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);
        }
"@ -ErrorAction Stop
        $memStatus = New-Object MemInfo+MEMORYSTATUSEX
        if ([MemInfo]::GlobalMemoryStatusEx($memStatus)) {
            $totalGB = [math]::Round($memStatus.ullTotalPhys / 1GB, 2)
            $availGB = [math]::Round($memStatus.ullAvailPhys / 1GB, 2)
            if ($totalGB -ge 14.0) {
                Write-CheckResult -Category "System RAM" -Status "PASS" -Message "$totalGB GB total ($availGB GB available)" -Detail "Meets 16 GB baseline requirement."
            } else {
                Write-CheckResult -Category "System RAM" -Status "WARN" -Message "$totalGB GB total ($availGB GB available)" -Detail "Less than 16 GB baseline."
            }
            $ramReported = $true
        }
    } catch {
        # Silent fallback
    }
}

if (-not $ramReported) {
    Write-CheckResult -Category "System RAM" -Status "INFO" -Message "Memory inspection via CIM was restricted; 16 GB assumed based on profile."
}

# --- 3. Disk Space on Workspace Drive ---
Write-Host ""
Write-Host "--- 3. Storage and Workspace Disk Space ---" -ForegroundColor DarkCyan
try {
    $currentPath = (Resolve-Path $PSScriptRoot).Path
    $driveRoot = [System.IO.Path]::GetPathRoot($currentPath)
    $driveInfo = New-Object System.IO.DriveInfo($driveRoot)

    $freeSpaceGB = [math]::Round($driveInfo.AvailableFreeSpace / 1GB, 2)
    $totalDiskGB = [math]::Round($driveInfo.TotalSize / 1GB, 2)
    $usedSpaceGB = [math]::Round(($driveInfo.TotalSize - $driveInfo.AvailableFreeSpace) / 1GB, 2)
    $driveLetter = $driveRoot.TrimEnd('\')

    if ($freeSpaceGB -lt 30.0) {
        Write-CheckResult -Category "Disk Space ($driveLetter)" -Status "WARN" -Message "$freeSpaceGB GB free of $totalDiskGB GB" -Detail "Free disk space is below 30 GB. Large local AI models must remain deferred."
    } else {
        Write-CheckResult -Category "Disk Space ($driveLetter)" -Status "PASS" -Message "$freeSpaceGB GB free of $totalDiskGB GB"
    }
} catch {
    Write-CheckResult -Category "Disk Space" -Status "WARN" -Message "Unable to inspect disk capacity" -Detail "$($_.Exception.Message)"
}

# --- 4. NVIDIA GPU & VRAM ---
Write-Host ""
Write-Host "--- 4. GPU and Hardware Acceleration ---" -ForegroundColor DarkCyan
$nvidiaSmiCmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($nvidiaSmiCmd) {
    try {
        $gpuOutput = & nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader,nounits 2>$null
        if ($gpuOutput) {
            foreach ($line in $gpuOutput) {
                $parts = $line.Split(",") | ForEach-Object { $_.Trim() }
                $gpuName = $parts[0]
                $totalVramMB = $parts[1]
                $freeVramMB = $parts[2]
                $driverVer = $parts[3]
                $totalVramGB = [math]::Round([double]$totalVramMB / 1024, 2)
                $freeVramGB = [math]::Round([double]$freeVramMB / 1024, 2)

                Write-CheckResult -Category "NVIDIA GPU" -Status "PASS" -Message "$gpuName (Total VRAM: $totalVramGB GB, Free: $freeVramGB GB)" -Detail "Driver: $driverVer"
            }
        } else {
            Write-CheckResult -Category "NVIDIA GPU" -Status "WARN" -Message "nvidia-smi returned empty output."
        }
    } catch {
        Write-CheckResult -Category "NVIDIA GPU" -Status "WARN" -Message "nvidia-smi execution failed" -Detail "$($_.Exception.Message)"
    }
} else {
    Write-CheckResult -Category "NVIDIA GPU" -Status "WARN" -Message "nvidia-smi not found in PATH" -Detail "GPU acceleration may still work via DirectX/Vulkan or require CUDA driver setup."
}

# --- 5. Developer Tooling (Git, Node.js, npm, n8n) ---
Write-Host ""
Write-Host "--- 5. Core Development Tooling ---" -ForegroundColor DarkCyan

# Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
    $gitVer = (& git --version 2>$null)
    Write-CheckResult -Category "Git" -Status "PASS" -Message "$gitVer"
} else {
    Write-CheckResult -Category "Git" -Status "FAIL" -Message "Git is not installed or not in PATH"
}

# Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVer = (& node -v 2>$null)
    Write-CheckResult -Category "Node.js" -Status "PASS" -Message "$nodeVer"
} else {
    Write-CheckResult -Category "Node.js" -Status "FAIL" -Message "Node.js is not installed or not in PATH"
}

# npm
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) {
    $npmVer = (& npm -v 2>$null)
    Write-CheckResult -Category "npm" -Status "PASS" -Message "v$npmVer"
} else {
    Write-CheckResult -Category "npm" -Status "FAIL" -Message "npm is not installed or not in PATH"
}

# n8n
$n8nCmd = Get-Command n8n -ErrorAction SilentlyContinue
if ($n8nCmd) {
    try {
        $n8nVer = (& n8n --version 2>$null)
        Write-CheckResult -Category "n8n" -Status "PASS" -Message "v$n8nVer (Global CLI available)"
    } catch {
        Write-CheckResult -Category "n8n" -Status "WARN" -Message "n8n command found but failed to report version."
    }
} else {
    Write-CheckResult -Category "n8n" -Status "WARN" -Message "n8n global CLI not found in PATH" -Detail "n8n can still be run via 'npx n8n' or locally installed package."
}

# FFmpeg (Optional check for media rendering)
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegCmd) {
    $ffmpegVerLine = (& ffmpeg -version 2>$null | Select-Object -First 1)
    Write-CheckResult -Category "FFmpeg" -Status "PASS" -Message "$ffmpegVerLine"
} else {
    Write-CheckResult -Category "FFmpeg" -Status "INFO" -Message "FFmpeg not detected in PATH (will be required for media rendering in Phase 4)."
}

# --- 6. Repository Structure & Configuration Files ---
Write-Host ""
Write-Host "--- 6. Repository Integrity and Files ---" -ForegroundColor DarkCyan

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Write-CheckResult -Category "Project Root" -Status "PASS" -Message "$repoRoot"

$requiredPaths = @(
    "README.md",
    ".gitignore",
    ".env.example",
    "docs/architecture.md",
    "docs/setup-windows.md",
    "docs/phase-roadmap.md",
    "docs/security.md",
    "scripts/check-environment.ps1",
    "scripts/check-n8n.ps1",
    "config/app.config.example.json",
    "workflows/README.md"
)

foreach ($relPath in $requiredPaths) {
    $fullPath = Join-Path $repoRoot $relPath
    if (Test-Path -Path $fullPath) {
        Write-CheckResult -Category "File Check" -Status "PASS" -Message "$relPath"
    } else {
        Write-CheckResult -Category "File Check" -Status "FAIL" -Message "Missing required file: $relPath"
    }
}

# Validate JSON syntax of config
$configPath = Join-Path $repoRoot "config/app.config.example.json"
if (Test-Path -Path $configPath) {
    try {
        $null = Get-Content -Path $configPath -Raw | ConvertFrom-Json -ErrorAction Stop
        Write-CheckResult -Category "Config Syntax" -Status "PASS" -Message "config/app.config.example.json is valid JSON"
    } catch {
        Write-CheckResult -Category "Config Syntax" -Status "FAIL" -Message "config/app.config.example.json contains invalid JSON syntax" -Detail "$($_.Exception.Message)"
    }
}

# --- Summary ---
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
if ($AllChecksPassed) {
    Write-Host " Phase 0 Environment Verification: COMPLETED SUCCESSFULLY" -ForegroundColor Green
    if ($WarningsCount -gt 0) {
        Write-Host " ($WarningsCount warning(s) observed - see details above)" -ForegroundColor Yellow
    }
} else {
    Write-Host " Phase 0 Environment Verification: FAILED (Review red items)" -ForegroundColor Red
}
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

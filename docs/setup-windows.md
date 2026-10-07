# Windows 11 Setup & Operations Guide

This guide provides instructions for verifying, running, and maintaining the **Loredotexe** environment on Windows 11.

---

## 1. Prerequisites & Tooling Verification

Before launching services, run the built-in Phase 0 verification scripts in PowerShell.

### A. Run Environment Verification
Open a PowerShell terminal (no Administrator elevation required) and execute:

```powershell
# From the project root (e:\Personal Projects\Loredotexe)
powershell -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1
```

This verifies:
- Windows version & system architecture
- Installed Git, Node.js, and npm versions
- NVIDIA GPU model & VRAM (via `nvidia-smi`)
- System RAM capacity (16 GB baseline)
- Free storage on the workspace drive
- Project folder integrity and configuration syntax

### B. Run n8n Status Inspector
To check whether n8n is installed and whether the local port (`5678`) is active:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-n8n.ps1
```

---

## 2. Launching and Running n8n Community Edition

Loredotexe uses local **n8n Community Edition** bound to `localhost:5678`.

### Option A: Launching via `npx` (No global install needed)
```powershell
npx n8n
```

### Option B: Installing & Launching Globally (Optional)
```powershell
npm install -g n8n
n8n start
```

### Accessing the UI
Once started, open your web browser to:
[http://localhost:5678](http://localhost:5678)

> **Important Security Rule**: Do not expose this port to the public internet or open firewall ports without authentication and SSL reverse proxying. Keep it bound to `127.0.0.1`.

---

## 3. Checking Hardware Metrics Manually

### Checking NVIDIA GPU and VRAM
```powershell
nvidia-smi
```
To view continuous live utilization:
```powershell
nvidia-smi -l 2
```

### Checking Free Disk Space
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}}, @{Name="Used(GB)";Expression={[math]::Round($_.Used/1GB,2)}}
```

---

## 4. Backup & Maintenance Procedures

### A. Backing Up Local n8n Data
Local n8n stores credentials, execution logs, and workflow databases in the user's home profile directory:
`C:\Users\<YourUsername>\.n8n\` (primarily `config` and `database.sqlite`).

To back up your n8n workflows and configuration:
```powershell
# Create a backup archive in your personal backup folder
$BackupDir = "$HOME\n8n_backups_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $BackupDir -Force
Copy-Item -Path "$HOME\.n8n" -Destination $BackupDir -Recurse
Write-Host "n8n data backed up to: $BackupDir"
```

### B. Backing Up the Loredotexe Repository
Because the repository excludes credentials and heavy media via `.gitignore`, you can back up the workspace directly via Git:
```powershell
git status
git add .
git commit -m "Phase 0: Environment foundation setup"
```

---

## 5. Status of Pipeline Dependencies

| Component | Status | Purpose | Installation / Action (When needed) |
|---|---|---|---|
| **Git** | Installed / Verified | Version control | Pre-installed |
| **Node.js & npm** | Installed / Verified | Runtime for n8n | Pre-installed |
| **n8n** | Local npm / npx | Automation Engine | `npx n8n` |
| **FFmpeg** | Deferred (Phase 4) | Video & audio rendering | Will be installed via `winget install Gyan.FFmpeg` or direct binary download in Phase 4 |
| **Edge-TTS** | Deferred (Phase 3) | Free Neural Voice Synthesis | `pip install edge-tts` (Phase 3) |
| **Ollama / Local LLM** | Optional / Deferred | Free local script generation | Optional, or use cloud free tiers |
| **Local Video Weights** | **Deferred Indefinitely** | Video generation models | Deferred due to `<30 GB` disk constraints |

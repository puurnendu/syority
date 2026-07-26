# Using Windows with Aurianoa OS / Syority

This project is **developed on Windows** and **deployed on Linux**.  
Shell scripts (`.sh`) are the production source of truth. PowerShell scripts (`.ps1`) mirror backup/restore/bootstrap behaviour for local Windows work.

---

## Script map

| Task | Windows (dev laptop) | Linux (production VPS) |
|---|---|---|
| Host prerequisites | `scripts/bootstrap.ps1` | `scripts/bootstrap.sh` (as root) |
| Backup DB + uploads | `scripts/backup.ps1` | `scripts/backup.sh` |
| Restore DB + uploads | `scripts/restore.ps1` | `scripts/restore.sh` |
| Deploy stack | Use Docker Compose locally; full prod deploy is `scripts/deploy.sh` on Linux | `scripts/deploy.sh` |
| TLS bootstrap | N/A (use HTTP compose or local ports) | `scripts/init-letsencrypt.sh` |

Backups from `.ps1` and `.sh` use the **same folder layout and filenames**, so a backup taken on Windows can be restored on Linux (and vice versa).

```text
BACKUP_DIR/<yyyyMMddTHHmmssZ>/
  postgres_syority.sql.gz
  postgres_syority.dump
  uploads.tar.gz
  MANIFEST.txt
  SHA256SUMS
```

---

## Option A — PowerShell (recommended for Windows development)

**Best for:** day-to-day backup/restore on a Windows laptop with Docker Desktop.

### Requirements

- Windows 10/11  
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running  
- PowerShell 5.1+ (built-in) or PowerShell 7+  
- Git (optional but recommended)

### First-time setup

```powershell
cd C:\DEV\STO
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   # once, if scripts are blocked
.\scripts\bootstrap.ps1
copy .env.example .env   # then edit .env
docker compose -f docker-compose.yml up -d --build
```

### Backup / restore

```powershell
# Optional: custom destination
$env:BACKUP_DIR = "D:\backups\syority"
.\scripts\backup.ps1

# Restore (stack must be running, especially db + app)
.\scripts\restore.ps1 D:\backups\syority\20260716T120000Z
```

### Notes

- `.ps1` scripts **refuse to run on Linux** and tell you to use the `.sh` versions.  
- Prefer **Docker Compose V2** (`docker compose`, not legacy `docker-compose`).  
- For local HTTP-only stacks you may use only `docker-compose.yml` (set `$env:COMPOSE_FILES` accordingly).

```powershell
$env:COMPOSE_FILES = "-f docker-compose.yml"
.\scripts\backup.ps1
```

---

## Option B — Git Bash

**Best for:** running the **same `.sh` scripts** you will use on the VPS, without WSL.

### Requirements

- [Git for Windows](https://git-scm.com/download/win) (includes Git Bash)  
- Docker Desktop running (Git Bash calls the Windows `docker.exe`)

### Examples

```bash
cd /c/DEV/STO
./scripts/backup.sh
BACKUP_DIR="/c/backups/syority" ./scripts/backup.sh
./scripts/restore.sh /c/backups/syority/20260716T120000Z
```

### Caveats

- Paths use Unix style (`/c/DEV/STO`).  
- Do **not** run `bootstrap.sh` on Windows — it expects Linux `apt`/`ufw`/`systemctl`. Use `bootstrap.ps1` on Windows, `bootstrap.sh` on the VPS.  
- Line endings: keep `.sh` files as LF. If a script fails with `$'\r': command not found`, convert CRLF → LF.  
- `deploy.sh` is intended for the **Linux VPS** production compose overlay (`docker-compose.prod.yml`). Running it unchanged on a laptop may conflict with local ports / SSL expectations.

---

## Option C — WSL (Ubuntu)

**Best for:** closest-to-production Linux shell on a Windows machine (optional).

### Requirements

- WSL2 + Ubuntu  
- Docker either:  
  - Docker Desktop with **WSL integration** enabled, or  
  - Docker Engine installed inside WSL  

### Examples

```bash
cd /mnt/c/DEV/STO
./scripts/backup.sh
sudo bash scripts/bootstrap.sh   # only if you treat this WSL distro like a mini-server
```

### Caveats

- File I/O under `/mnt/c/...` can be slower; for heavy Docker builds, clone into the Linux filesystem (`~/code/...`).  
- Firewall/`ufw` inside WSL is not the same as the production VPS firewall.  
- Production cutover still happens on a real Linux VPS, not WSL.

---

## What to use when

| Goal | Recommendation |
|---|---|
| **Daily development on Windows** | **PowerShell** + Docker Desktop (`bootstrap.ps1`, `backup.ps1`, `restore.ps1`, `docker compose`) |
| **Practice the exact Linux backup/restore commands** | Git Bash or WSL running `.sh` scripts |
| **Production deploy / TLS / UFW / migrator** | **Linux VPS only** — `bootstrap.sh`, `deploy.sh`, `init-letsencrypt.sh`, `backup.sh` via cron |

### Required for production

1. Ubuntu 22.04/24.04 VPS  
2. `sudo bash scripts/bootstrap.sh`  
3. Application code + `.env` on the server  
4. `./scripts/init-letsencrypt.sh <email>` (when DNS points at the VPS)  
5. `./scripts/deploy.sh`  
6. Cron (or equivalent) calling `./scripts/backup.sh`  
7. Off-box copy of backup folders (see `docs/DISASTER_RECOVERY.md`)

Windows PowerShell scripts are **not** a substitute for production deploy on Linux.

---

## Interchangeable backups (Windows ↔ Linux)

| Taken with | Restored with |
|---|---|
| `backup.ps1` on Windows | `restore.sh` on VPS **or** `restore.ps1` on Windows |
| `backup.sh` on VPS | `restore.ps1` on Windows **or** `restore.sh` on VPS |

Always verify `SHA256SUMS` after copying backup folders between machines.

---

## Quick troubleshooting

| Symptom | Fix |
|---|---|
| `ExecutionPolicy` blocks `.ps1` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Docker engine not running | Start Docker Desktop; wait until status is Running |
| `Database container is not ready` | `docker compose up -d` then retry backup/restore |
| Bash `$'\r': command not found` | Convert script to LF line endings |
| Ran `bootstrap.sh` on Windows | Stop; use `bootstrap.ps1` instead |
| Ran `bootstrap.ps1` on Linux | Stop; use `sudo bash scripts/bootstrap.sh` |

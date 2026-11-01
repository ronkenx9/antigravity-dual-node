Set-Location $PSScriptRoot
$host.UI.RawUI.WindowTitle = "HP OMEN GPU Worker Daemon"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HP OMEN Antigravity LAN Worker Daemon" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
python scripts\win\lan-worker.py

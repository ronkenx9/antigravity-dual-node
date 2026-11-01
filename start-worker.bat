@echo off
title HP OMEN GPU Worker Daemon
cd /d "%~dp0"
echo ============================================================
echo   HP OMEN Antigravity LAN Worker Daemon
echo ============================================================
python scripts\win\lan-worker.py
pause

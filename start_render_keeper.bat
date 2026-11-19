@echo off
title AgriShield Render Cluster Keep-Alive Daemon
echo =====================================================================
echo  AgriShield Cloud Keep-Alive Daemon (Zero-Cold-Start Presentation Mode)
echo =====================================================================
echo  Pinging Render instances every 7 minutes to keep models hot in memory.
echo  Keep this window open during your college presentation / viva!
echo =====================================================================
echo.
if exist .\.venv\Scripts\python.exe (
    .\.venv\Scripts\python.exe scripts\render_cluster_keeper.py --interval 420
) else (
    python scripts\render_cluster_keeper.py --interval 420
)
pause

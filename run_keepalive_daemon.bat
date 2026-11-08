@echo off
title AgriShield Render Cluster Keep-Alive Daemon
cls
echo ====================================================================
echo  Starting AgriShield Render Cluster 24/7 Keep-Alive Daemon...
echo  Keeping Main, Worker 1, Worker 2, and Worker 3 hot and active.
echo ====================================================================
python "%~dp0scripts\render_cluster_keeper.py"
pause

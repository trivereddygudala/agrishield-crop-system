@echo off
title AgriShield - Full Stack Dev Server
cd /d "%~dp0"
echo ======================================================================
echo  Starting AgriShield System (Frontend + Backend + Server Analyzer)...
echo ======================================================================
echo.
npm.cmd run dev
pause

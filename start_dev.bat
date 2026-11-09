@echo off
title AgriShield - Full Stack Dev Server
cd /d "%~dp0"
echo ======================================================================
echo  Starting AgriShield System (Frontend + Backend + Server Analyzer)...
echo ======================================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found in .venv\Scripts\python.exe!
    echo Please make sure your Python virtual environment is set up.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [*] Installing root dependencies...
    call npm.cmd install
)

if not exist "frontend\node_modules" (
    echo [*] Installing frontend dependencies...
    cd frontend && call npm.cmd install && cd ..
)

echo.
echo ======================================================================
echo  Server Endpoints:
echo    - Frontend App:  http://localhost:3000
echo    - Backend API:   http://localhost:8000
echo    - API Docs:      http://localhost:8000/docs
echo    - Health Check:  http://localhost:8000/health
echo ======================================================================
echo.

call npm.cmd run dev
if errorlevel 1 (
    echo.
    echo [INFO] If you encountered an execution policy issue in PowerShell, run:
    echo   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
    echo Or launch AgriShield via Command Prompt with:
    echo   npm.cmd run dev
)
pause

@echo off
title Crop Disease Model Testing Website
cd /d "%~dp0"
echo ====================================================================
echo   Starting Standalone Crop Disease Model Testing Website
echo   Model: datasets/crop_disease_model/checkpoints/best_model.pth
echo   Total Classes: 1,252
echo   Website URL: http://localhost:5050
echo   NOTE: This is isolated and does not touch your main website.
echo ====================================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found in .venv\Scripts\python.exe!
    pause
    exit /b 1
)

.venv\Scripts\python.exe test_crop_model_server.py
pause

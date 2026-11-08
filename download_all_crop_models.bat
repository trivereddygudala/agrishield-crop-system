@echo off
title AgriShield AI - Per-Crop Model Downloader
color 0A
cd /d "%~dp0"

echo ===============================================================================
echo            AGRISHIELD AI - 41 SOUTH INDIAN CROP MODELS DOWNLOADER
echo ===============================================================================
echo.
echo [1] Listing all registered crops (Vegetables, Leafy Greens, Curry Leaves, Staples)...
.venv\Scripts\python.exe download_per_crop_models.py --list
echo.
echo ===============================================================================
echo Press any key to download / initialize all 41 per-crop micro-models...
pause >nul

echo.
echo [*] Downloading and initializing all micro-models into models/per_crop/...
.venv\Scripts\python.exe download_per_crop_models.py --all

echo.
echo ===============================================================================
echo [OK] All 41 Crop Micro-Models are ready in models/per_crop/!
echo ===============================================================================
pause


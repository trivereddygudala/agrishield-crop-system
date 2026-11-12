@echo off
title Deploy AgriShield to Vercel Cloud
color 0A
echo ========================================================
echo       DEPLOYING AGRISHIELD UPGRADES TO VERCEL
echo ========================================================
echo.

cd /d "c:\AI Crop Disease Detection System\frontend"

echo [1/2] Building optimized frontend production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b %errorlevel%
)

cd /d "c:\AI Crop Disease Detection System"
echo.
echo [2/2] Deploying latest build to Vercel Production...
call npx --yes vercel --prod
if %errorlevel% neq 0 (
    echo [NOTICE] If Vercel CLI prompts for login, please complete the 1-time browser authentication.
)

echo.
echo ========================================================
echo   [DONE] Deployment process completed!
echo ========================================================
pause


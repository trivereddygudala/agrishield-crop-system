@echo off
title Step 2: Deploy AgriShield to Live Web
color 0B
echo ========================================================
echo       STEP 2: DEPLOYING AGRISHIELD TO FIREBASE CLOUD
echo ========================================================
echo.

cd /d "c:\AI Crop Disease Detection System\frontend"

echo [1/3] Packaging latest frontend build...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Please check frontend files.
    pause
    exit /b %errorlevel%
)

cd /d "c:\AI Crop Disease Detection System"
echo.
echo [2/3] Uploading website files to Google's worldwide servers...
call npx --yes firebase-tools deploy --only hosting
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Deployment failed. Did you complete Step 1 (1_login_firebase.bat)?
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo   [SUCCESS] Your AgriShield website is now 100% LIVE!
echo   Opening: https://agrishield-ai-498f3.web.app
echo ========================================================
echo.

start https://agrishield-ai-498f3.web.app
pause


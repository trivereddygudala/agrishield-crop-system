@echo off
echo ===================================================
echo     AgriShield AI - Firebase Hosting Deployment
echo ===================================================
echo.

cd /d "c:\AI Crop Disease Detection System\frontend"

echo [1/3] Building production assets...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed! Aborting deployment.
    pause
    exit /b %errorlevel%
)

cd /d "c:\AI Crop Disease Detection System"
echo.
echo [2/3] Checking Firebase Login status...
call npx --yes firebase-tools login:list

echo.
echo [3/3] Deploying to Firebase Hosting (agrishield-ai-498f3)...
call npx --yes firebase-tools deploy --only hosting

echo.
echo ===================================================
echo   Deployment completed! 
echo   Live URL: https://agrishield-ai-498f3.web.app
echo ===================================================
pause


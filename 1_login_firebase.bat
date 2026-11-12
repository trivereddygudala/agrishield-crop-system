@echo off
title Step 1: Login to Firebase
color 0A
echo ========================================================
echo        STEP 1: LOGIN TO YOUR GOOGLE FIREBASE ACCOUNT
echo ========================================================
echo.
echo 1. Your web browser will open in a few seconds.
echo 2. Choose your Google account (the one you used for Firebase).
echo 3. Click "Allow".
echo.
echo Press any key to open the Google login page...
pause >nul
echo.
echo Connecting to Google...

cd /d "c:\AI Crop Disease Detection System"
call npx --yes firebase-tools login

echo.
echo ========================================================
if %errorlevel% equ 0 (
    echo [SUCCESS] You are logged in!
    echo Now close this window and double-click "2_deploy_website.bat".
) else (
    echo [NOTICE] If browser did not open, try running again.
)
echo ========================================================
echo.
pause


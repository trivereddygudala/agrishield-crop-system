@echo off
title Antigravity Brain Vault - Power-Proof History
echo ========================================================
echo   🛡️  ANTIGRAVITY BRAIN VAULT - POWER-PROOF RESTORER
echo ========================================================
echo.
echo [1/2] Checkpointing SQLite WAL files & updating index...
python scripts\build_brain_vault.py

echo.
echo [2/2] Opening Interactive Brain Vault in browser...
start "" "%~dp0brain_vault\index.html"

echo.
echo ========================================================
echo   Vault opened! If desktop lost power:
echo   1. Copy the 1-Click Resume Prompt from the dashboard
echo   2. Paste it into your Antigravity chat input
echo ========================================================
echo.
python scripts\resume_session.py
pause

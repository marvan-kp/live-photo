@echo off
title Signature by Marvan - Live Camera Tether Watcher
color 0E

echo ======================================================================
echo           SIGNATURE BY MARVAN - LIVE CAMERA TETHER ENGINE
echo ======================================================================
echo.

set /p EVENT_ID="Enter Event ID (Press Enter for default: sample2-mw80dckt): "
if "%EVENT_ID%"=="" set EVENT_ID=sample2-mw80dckt

set /p TETHER_DIR="Enter Camera Tether Folder path (e.g. C:\Photos\Tether): "
if "%TETHER_DIR%"=="" set TETHER_DIR=%cd%\tether_photos

echo.
echo Starting Camera Watcher for Event: %EVENT_ID%
echo Monitoring folder: %TETHER_DIR%
echo.

node "%~dp0camera-watcher.mjs" --event="%EVENT_ID%" --folder="%TETHER_DIR%" --server="https://web-rho-sage-25.vercel.app" --key="marvan2026"

pause

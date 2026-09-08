@echo off
title CBRE Helpdesk Tracker - Launching Web App
color 0A

echo =======================================================
echo     CBRE HELPDESK TRACKER HUB - WEB APP LAUNCHER
echo =======================================================
echo.

:: Add portable nodejs to PATH if not already in system PATH
set "PATH=C:\Users\SMohanty6\AppData\Local\PortableTools\nodejs;%PATH%"

:: Change to script directory
cd /d "%~dp0"

echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js executable not found.
    pause
    exit /b 1
)
node -v
echo.

echo [2/3] Starting Vite Web Server on http://localhost:3000 ...
echo [3/3] Opening application in your default browser...

:: Open browser after 2 seconds
start "" http://localhost:3000/

:: Run Vite dev server
npm run dev -- --port 3000

pause

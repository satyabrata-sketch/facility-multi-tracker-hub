@echo off
title CBRE Helpdesk Tracker - Local Server
color 0B

echo =======================================================
echo     CBRE HELPDESK TRACKER HUB - PRODUCTION SERVER
echo =======================================================
echo.

cd /d "%~dp0"

echo Opening http://localhost:3000 in your browser...
start "" http://localhost:3000/

echo Serving production build from 'dist' folder...
python -m http.server 3000 --directory dist

pause

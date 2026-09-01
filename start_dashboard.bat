@echo off
title CBRE Facility Trackers - Live Web Analytics Hub
echo ======================================================================
echo    Starting Facility Operations Multi-Tracker Web Application...
echo ======================================================================
echo.
echo [*] Safe non-locking Excel reader active (safe for shared OneDrive files)
echo [*] Launching local server at http://localhost:8080 ...
echo.

start "" "http://localhost:8080"
python server.py

pause

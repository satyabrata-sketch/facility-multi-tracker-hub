@echo off
setlocal
title Facility Trackers - Firebase Cloud Live Sync Daemon

echo ===============================================================================
echo     Facility Multi-Tracker Hub - Firebase Cloud Continuous Sync
echo ===============================================================================
echo.
echo [*] Watching Excel files for modifications (non-locking)...
echo [*] Changes will automatically sync to Firebase Cloud Firestore.
echo.

python firebase_sync.py --watch --interval 3

pause

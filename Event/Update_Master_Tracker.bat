@echo off
title Updating Master Event Tracker...
echo ==============================================================================
echo       AUTOMATED MASTER EVENT TRACKER SYNCHRONIZATION
echo ==============================================================================
echo Scanning all monthly event sheets and syncing Master Event Tracker 2026...
echo.
python "%~dp0Update_Master_Tracker.py"
echo.
echo ==============================================================================
echo Synchronization Complete! Press any key to exit.
echo ==============================================================================
pause

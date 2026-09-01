@echo off
setlocal enabledelayedexpansion
title Facility Multi-Tracker - GitHub & Vercel Deployment Helper

echo ===============================================================================
echo     Facility Multi-Tracker Hub - GitHub & Vercel Deployment
echo ===============================================================================
echo.
echo [*] Local Git repository is ready on branch 'main'.
echo.

set "GIT_EXE=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if not exist "%GIT_EXE%" (
    set "GIT_EXE=git"
)

echo [1] Check current Git status:
"%GIT_EXE%" status --short
echo.

echo ===============================================================================
echo  STEP 1: CONNECT TO GITHUB
echo ===============================================================================
echo  1. Create a new repository on GitHub (https://github.com/new)
echo     Name: facility-multi-tracker-hub (or any name you prefer)
echo     Do NOT check 'Initialize with README' or '.gitignore' (we already have them)
echo.
echo  2. Copy your GitHub repository URL (e.g. https://github.com/username/repo.git)
echo ===============================================================================
echo.

set /p REPO_URL="Enter your GitHub Repository URL (or press Enter to skip): "

if not "%REPO_URL%"=="" (
    echo.
    echo [*] Setting remote origin to: %REPO_URL%
    "%GIT_EXE%" remote remove origin >nul 2>&1
    "%GIT_EXE%" remote add origin %REPO_URL%
    echo [*] Pushing code to GitHub main branch...
    "%GIT_EXE%" push -u origin main
    if !errorlevel! equ 0 (
        echo.
        echo [SUCCESS] Code pushed to GitHub successfully!
    ) else (
        echo.
        echo [!] Note: If GitHub prompted for credentials, use a Personal Access Token or GitHub CLI.
    )
)

echo.
echo ===============================================================================
echo  STEP 2: DEPLOY TO VERCEL (1-Click)
echo ===============================================================================
echo  1. Go to: https://vercel.com/new
echo  2. Click 'Import' next to your GitHub repository
echo  3. Framework Preset: Other (Static)
echo  4. Root Directory: ./
echo  5. Click 'Deploy'
echo.
echo  Vercel will provide your live 24/7 global web link in seconds!
echo ===============================================================================
echo.
pause

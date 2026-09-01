# Facility Multi-Tracker Live Web Analytics Hub

> **Real-Time Operations Command Center for Equipment Breakdowns, Key & Locker Asset Audits, Event Operations, F&B Expenditures, and Contractual Staff Compliance.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/facility-multi-tracker-hub)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Platform: Live Excel Sync](https://img.shields.io/badge/Platform-Live%20Excel%20Sync-blue.svg)](#)

---

## 🌟 Executive Overview

This web application serves as a **single-pane-of-glass Operations Command Center** for facilities teams. It monitors and consolidates live Excel trackers across multiple operational domains in real time, with zero file locking.

### 📊 Active Trackers & Modules Included

| Module | Source Tracker | Live Records | Key Metrics & Highlights |
| :--- | :--- | :---: | :--- |
| **📊 All Trackers Dashboard** | *Consolidated Master* | **2,848+** | Master search box across all trackers, consolidated status table, domain performance summaries. |
| **🛠️ Equipment Breakdowns** | `Breakdown/Breakdown Tracker.xlsx` | **235** | 95.7% resolution rate, 7 WIP, 3 Open, 115.6h avg lead time, full vs partial downtime filters. |
| **🔐 Keys & Locker Assets** | `Locker/Keys Lock Tracker - 2026 1.xlsx` | **244** | 527 keys total, 370 BMS spare, 94 issued to staff, 67 missing keys alert, 20 pending action items. |
| **📅 Events Operations (DT-3/4)** | `Event/Yearly Event Tracker...xlsx` | **1,857** | Full year 2026 event records across Downtown-3 and Downtown-4, calendar confirmation statuses. |
| **🍽️ F&B Operations & Cost** | `F&B/Event_Tracker_Pro...xlsx` | **63** | ₹2.48M total spend, 14,280 pax, ₹173.7 effective cost/pax, primary vendor breakdown. |
| **👥 Contractual Staff (VAS)** | `VAS/Contractual Staff Details...xlsx` | **449** | 229 active staff, 94.2% BGV compliant, agency breakdown, NAB location & designation filters. |

---

## ⚡ Key Highlights & Features

1. **Master Search Box on Every Section**: Instant multi-column real-time search with clear buttons (`✕`) and live match counters.
2. **Short, Simple, Crisp Language & Table Form**: Clean, high-density tables with sticky headers, column sorting ($\uparrow/\downarrow$), and customizable rows per page (15, 25, 50, 100, All).
3. **100% Non-Locking Real-Time Excel Sync**: Uses in-memory binary streaming (`io.BytesIO`) to read file bytes in $<2\text{ ms}$, releasing file handles instantly. Teammates can keep Excel open in OneDrive without file collision errors.
4. **4-Second Auto-Sync Heartbeat**: Continuously monitors Excel file modification timestamps and MD5 hashes, refreshing data tables automatically without page reload.
5. **1-Click Downloads**: Dedicated **Download Excel** (`.xlsx`) and **Export CSV** (`.csv`) buttons in every section.

---

## 🚀 How to Run Locally

### Option A: 1-Click Launch (Recommended)
Double-click [`start_dashboard.bat`](start_dashboard.bat).
* Starts the Python live sync server.
* Automatically opens your default web browser to **`http://localhost:8080`**.

### Option B: Terminal / Command Prompt
```bash
python server.py
```
Open your browser at `http://localhost:8080`.

### Option C: Direct Offline File Mode
Open `index.html` directly in any web browser. It uses pre-compiled `data.js` for immediate offline preview.

---

## ☁️ Deploying to GitHub & Vercel

### Step 1: Connect to GitHub

1. Initialize git and commit your files:
   ```bash
   git init
   git add .
   git commit -m "feat: Facility Multi-Tracker Web Hub with Master Search and Table views"
   ```

2. Create a new repository on [GitHub](https://github.com/new) (e.g. `facility-multi-tracker-hub`).

3. Link your remote repository and push:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/facility-multi-tracker-hub.git
   git push -u origin main
   ```

---

### Step 2: Deploy to Vercel (1-Click or CLI)

#### Method A: Via Vercel Web Dashboard (Easiest)
1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Click **"Import"** next to your GitHub repository `facility-multi-tracker-hub`.
3. Keep default settings:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
4. Click **"Deploy"**.
5. Vercel will instantly build and provide a live production URL (e.g. `https://facility-multi-tracker-hub.vercel.app`) with automatic SSL.

#### Method B: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 📁 Repository Structure

```
Trackers/
├── index.html                  # Main responsive web application
├── data.js                     # Pre-compiled JSON snapshot dataset
├── server.py                   # Non-locking HTTP server with API endpoints
├── tracker_engine.py           # Multi-tracker Excel parsing & analytics engine
├── start_dashboard.bat         # 1-Click launcher for Windows
├── vercel.json                 # Vercel deployment configuration & routing
├── package.json                # Project metadata & npm scripts
├── .gitignore                  # Ignores temp lock files & pycache
├── README.md                   # Repository documentation
├── Breakdown/
│   └── Breakdown Tracker.xlsx  # Live 2026 & Historical Breakdown tracker
├── Locker/
│   └── Keys Lock Tracker...    # Master key custody & audit tracker
├── Event/
│   └── Yearly Event Tracker... # DT-3 & DT-4 2026 Event tracker
├── F&B/
│   └── Event_Tracker_Pro...    # F&B operations & budget tracker
└── VAS/
    └── Contractual Staff...    # Contractual staff deployment & BGV tracker
```

---

## 🔒 License
MIT License. Developed for CBRE Facility Operations.

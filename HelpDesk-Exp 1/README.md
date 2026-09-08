# CBRE Helpdesk Tracker Web App

A high-performance, real-time Helpdesk Tracker web application built with **React**, **Tailwind CSS**, **AG Grid**, **Recharts**, **SheetJS (`xlsx-js-style`)**, and **Google Firebase Firestore & Authentication**.

---

## 🚀 Key Upgrades & New Features

### 1. Dedicated Ticket Creation & Update Page ([`TicketPage.jsx`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/src/components/TicketPage.jsx))
- Clicking **"+ New Ticket"** opens a dedicated, full-screen creation page.
- Clean 4-section layout with large touch targets (44px min height).
- Native mobile date/time pickers and autocomplete datalists.
- Mobile sticky bottom action bar: "Cancel" & "Save Ticket" within thumb reach on phones.
- Inline validations and auto-generated serial numbers.

### 2. Adaptive Mobile UI ([`MobileTicketList.jsx`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/src/components/MobileTicketList.jsx))
- **Auto-adaptive UI**: On mobile phones, switches to an interactive **Card Feed View**.
- View mode switcher: Toggle between **Cards View** and **Table View (AG Grid)** on any screen.
- Floating Action Button (FAB) on mobile bottom-right for instant 1-thumb ticket creation.
- Quick status toggle directly on mobile cards.

### 3. Year-Wise Tabs: FY 2025-26 & FY 2024-25
- Navigation tabs: **2026 (FY 25-26)**, **2025 (FY 24-25)**, and **All Years**.
- New tickets automatically tag the active year.
- Filter, fetch, and update year-wise.

### 4. Advanced Analytics with Dedicated Filter Bar & 2 Multi-Year Sections ([`AnalyticsDashboard.jsx`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/src/components/AnalyticsDashboard.jsx))
- **Dedicated Filter Bar**:
  - Floor / Site (`DT3`, `DT4 L1`, `DT4 L4`, `DT4 L5`, `DT4 L6`)
  - Category (`Housekeeping`, `HVAC`, `E&M`, `Event`, `EMPLOYEE ACCESS`, `Locker request`)
  - Call Type (`Proactive`, `Reactive`)
  - Request Via (`In person`, `Phone`, `Mail`, `Feedback Form`)
  - Month (`YYYY-MM`)
  - Status (`Resolved`, `Not Resolved`, `Open`, `In-Progress`)
  - Active filters badge counter & "Reset Filters" button.
- **Section 1: FY 2025-26 Operations (Current Year)**:
  - 4 KPI cards: Total Logged, Open/In-Progress, Resolved count & %, SLA TAT Compliance %.
  - 2026 Status Donut Chart & 2026 Requests by Category Bar Chart.
- **Section 2: FY 2024-25 Operations (Historical Baseline)**:
  - 4 KPI cards: Total Historical, Resolution %, Proactive Calls %, Top Category.
  - 2025 Status Breakdown & 2025 Requests by Category Bar Chart.
- **Section View Switcher**: View side-by-side, or isolate 2026 or 2025.

### 5. Professional Excel Export Matching Original Tracker ([`excelHelper.js`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/src/utils/excelHelper.js))
- **Full Cell Borders**: Thin borders applied on all 4 sides of every single cell (`#D1D5DB`).
- **CBRE Navy Header**: Background fill `#1E293B`, bold white font (`#FFFFFF`), centered, 28pt height.
- **Alternating Row Styling**: White (`#FFFFFF`) and ice grey (`#F8FAFC`).
- **Status & Priority Color Coding**: Green highlight for Resolved, Red for Not Resolved / Breached TAT, Amber for High/Medium priority.
- **Native Excel Autofilter Dropdowns**: Autofilter active on all 20 headers (`ws['!autofilter']`).
- **Frozen Panes**: Frozen row 1 and first 2 columns (`Sr no.` & `Site `).
- **Exact Column Widths**: Arranged so no manual formatting in Excel is needed.

---

## 📊 Exact 20-Column Database Schema

1. `Sr no.` (Frozen Left)
2. `Site ` (Frozen Left, Dropdown)
3. `Zone` (Dropdown: Zone A to F)
4. `Location` (Text / Datalist)
5. `Month ` (Date YYYY-MM-DD)
6. `Date ` (Date YYYY-MM-DD)
7. `Report Time` (Time HH:MM:SS)
8. `Request category` (Dropdown: Housekeeping, HVAC, E&M, Event, EMPLOYEE ACCESS, Locker request)
9. `Employee Name ` (Text / Engineer name)
10. `Request Via ` (Dropdown: In person, Phone, Mail, Feedback Form)
11. `Discription ` (Textarea)
12. `Action Taken ` (Textarea)
13. `Date close ` (Date YYYY-MM-DD)
14. `Resolved time` (Time HH:MM:SS)
15. `Status ` (Dropdown: Resolved, Not Resolved, In-Progress, Open)
16. `Request from ` (Text)
17. `Call type` (Dropdown: Proactive, Reactive)
18. `Remark` (Text)
19. `is On TAT` (Dropdown: 1 - Within TAT, 0 - TAT Breached)
20. `Priority` (Dropdown: High, Medium, Low)

---

## 🛠️ How to Launch Locally

Double-click:
- **[`START-APP.bat`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/START-APP.bat)** (Development Server on `http://localhost:3000`)
- **[`RUN-LOCAL-SERVER.bat`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/RUN-LOCAL-SERVER.bat)** (Production Server from `dist`)

---

## ☁️ Connecting Google Firebase Firestore (Backend Database)

The application utilizes **Google Firebase Firestore** as a serverless, real-time backend-as-a-service (BaaS). All updates sync simultaneously across multiple users and browser tabs without needing a dedicated maintenance-heavy server.

### Step 1: Create a Project in Firebase Console
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **"Add project"**.
2. Name your project (e.g. `cbre-helpdesk-tracker`).
3. (Optional) Disable or enable Google Analytics, then click **"Create project"**.

### Step 2: Enable Cloud Firestore
1. In the left sidebar, navigate to **Build > Firestore Database**.
2. Click **"Create database"**.
3. Choose a server location closest to your team (e.g. `asia-south1` for Mumbai/India).
4. Start in **Production mode** (or Test mode).
5. In the **Rules** tab, paste the rules from [`firestore.rules`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/firestore.rules):
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tickets/{ticketId} {
      allow read, write: if true;
    }
  }
}
```
6. Click **Publish**.

### Step 3: Enable Firebase Authentication
1. In the left sidebar, navigate to **Build > Authentication**.
2. Click **"Get started"**, select **Email/Password**, and enable it.

### Step 4: Register Web App & Get Configuration
1. In Project Settings (gear icon at top left) > **General**, scroll down to **Your apps**.
2. Click the **Web icon (`</>`)**, enter an app nickname (e.g., `cbre-helpdesk-web`), and register.
3. Copy the `firebaseConfig` credentials.

### Step 5: Connect to the App
You have two easy ways to connect:
- **Option A (Instant In-App UI)**: Click the **Firebase Settings** (gear icon) in the top navbar, paste your config JSON, and click **Save & Reconnect**.
- **Option B (Environment File)**: Create a `.env` file in the root folder (copy from `.env.example`):
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

---

## 🚀 Deploying to Vercel (Production & CI/CD Automation)

The project includes [`vercel.json`](file:///C:/Users/SMohanty6/OneDrive%20-%20CBRE,%20Inc/Desktop/Trackers/HelpDesk-Exp%201/vercel.json) pre-configured for single-page routing and automated Vite builds.

### Step 1: Push to GitHub / GitLab
```bash
git init
git add .
git commit -m "feat: complete CBRE helpdesk tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cbre-helpdesk-tracker.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Log into [Vercel](https://vercel.com/).
2. Click **"Add New..." > "Project"**.
3. Select your GitHub repository.
4. Framework Preset will automatically detect **Vite**.
5. Build Command: `npm run build` | Output Directory: `dist`.

### Step 3: Add Environment Variables in Vercel
In the Vercel project configuration page, open **Environment Variables** and add:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Step 4: Click Deploy
Vercel will build the production bundle and assign an HTTPS URL (e.g., `https://cbre-helpdesk-tracker.vercel.app`).

### Continuous Automation:
- **Instant CI/CD**: Every Git commit to `main` automatically triggers a zero-downtime rebuild and deployment.
- **Serverless API / Automations**: Add serverless endpoints in an `/api` directory for webhooks, cron jobs, or Slack/Teams notifications if needed.


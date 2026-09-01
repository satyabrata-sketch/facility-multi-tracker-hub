const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 1. GET /api/data: Return full live snapshot from Firestore
app.get("/api/data", async (req, res) => {
  try {
    const summaryDoc = await db.collection("facility_trackers").document("executive_summary").get();
    const snapshotDoc = await db.collection("facility_trackers").document("live_snapshot").get();

    if (!summaryDoc.exists) {
      return res.status(404).json({ error: "No tracker data found. Run firebase_sync.py to upload live dataset." });
    }

    const executiveKpis = summaryDoc.data();
    const trackersList = snapshotDoc.exists ? snapshotDoc.data().trackers_list || [] : ["breakdown", "locker", "events", "fnb", "staff"];

    const trackersData = {};
    for (const tid of trackersList) {
      const tDoc = await db.collection("facility_trackers").document(`tracker_${tid}`).get();
      if (tDoc.exists) {
        trackersData[tid] = tDoc.data();
      }
    }

    return res.status(200).json({
      executive_kpis: executiveKpis,
      trackers: trackersData,
      timestamp: new Date().toISOString(),
      server_status: "firebase_cloud"
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/status: Lightweight status check
app.get("/api/status", async (req, res) => {
  try {
    const summaryDoc = await db.collection("facility_trackers").document("executive_summary").get();
    return res.status(200).json({
      status: "online",
      server: "Firebase Cloud Serverless",
      last_synced_at: summaryDoc.exists ? summaryDoc.data().last_synced_at : null,
      timestamp: Date.now()
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/sync: Ingest tracker payload from sync agents or automated CI/CD
app.post("/api/sync", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.trackers) {
      return res.status(400).json({ error: "Invalid payload format." });
    }

    await db.collection("facility_trackers").document("executive_summary").set(payload.executive_kpis || {});
    await db.collection("facility_trackers").document("live_snapshot").set({
      timestamp: payload.timestamp || new Date().toISOString(),
      executive_kpis: payload.executive_kpis || {},
      trackers_list: Object.keys(payload.trackers)
    });

    for (const [tid, tdata] of Object.entries(payload.trackers)) {
      await db.collection("facility_trackers").document(`tracker_${tid}`).set(tdata);
    }

    return res.status(200).json({ success: true, message: `Synced ${Object.keys(payload.trackers).length} trackers.` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. POST /api/webhook/onedrive: Automated Microsoft Graph Webhook receiver
app.post("/api/webhook/onedrive", async (req, res) => {
  // Handle Microsoft Graph validation handshake token
  if (req.query && req.query.validationToken) {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(req.query.validationToken);
  }

  // Handle incoming notification
  console.log("Received OneDrive change notification:", JSON.stringify(req.body));
  return res.status(202).json({ received: true });
});

exports.api = functions.https.onRequest(app);

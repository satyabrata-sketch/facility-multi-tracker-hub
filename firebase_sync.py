import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
from tracker_engine import TrackerEngine, get_file_meta

WORKSPACE_ROOT = os.path.dirname(os.path.abspath(__file__))
ENGINE = TrackerEngine(WORKSPACE_ROOT)

def load_local_payload():
    """Extract full consolidated dataset from all Excel files via non-locking binary stream."""
    return ENGINE.get_full_payload()

def sync_via_firebase_admin(payload: dict, cred_path: str = "serviceAccountKey.json"):
    """
    Sync payload directly to Firebase Cloud Firestore using firebase-admin SDK.
    Stores data under collection 'facility_trackers', document 'live_data'.
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not os.path.exists(cred_path):
            print(f"[!] Service account key file not found at: {cred_path}")
            print("[*] Falling back to REST API or local storage.")
            return False

        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)

        db = firestore.client()
        
        # 1. Update live executive summary document
        db.collection("facility_trackers").document("executive_summary").set(payload["executive_kpis"])
        
        # 2. Update each tracker document individually for fast querying
        for tid, tdata in payload["trackers"].items():
            db.collection("facility_trackers").document(f"tracker_{tid}").set(tdata)

        # 3. Save full snapshot
        db.collection("facility_trackers").document("live_snapshot").set({
            "timestamp": payload["timestamp"],
            "executive_kpis": payload["executive_kpis"],
            "trackers_list": list(payload["trackers"].keys())
        })

        print(f"[SUCCESS] Uploaded {len(payload['trackers'])} trackers to Firebase Firestore successfully!")
        return True

    except Exception as e:
        print(f"[ERROR] Firebase Admin sync failed: {e}")
        return False

def sync_via_firebase_rest(payload: dict, database_url: str, auth_secret: str = None):
    """
    Sync payload to Firebase Realtime Database via standard HTTPS REST API.
    Works without needing complex local service account files.
    """
    if not database_url:
        print("[!] No Firebase Database URL provided.")
        return False

    db_url = database_url.rstrip("/")
    endpoint = f"{db_url}/facility_trackers.json"
    if auth_secret:
        endpoint += f"?auth={auth_secret}"

    try:
        data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=data_bytes,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="PUT"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 204):
                print(f"[SUCCESS] Uploaded {len(payload['trackers'])} trackers to Firebase Realtime Database via REST!")
                return True
            else:
                print(f"[!] Firebase REST response status: {resp.status}")
                return False
    except Exception as e:
        print(f"[ERROR] Firebase REST sync failed: {e}")
        return False

def run_watch_loop(interval_sec: int = 5, cred_path: str = "serviceAccountKey.json", db_url: str = None):
    """Continuously monitor Excel files and auto-sync to Firebase on change."""
    print("=" * 65)
    print("   🔥 Facility Multi-Tracker Firebase Cloud Continuous Sync")
    print("=" * 65)
    print(f"[*] Workspace Root: {WORKSPACE_ROOT}")
    print(f"[*] Polling interval: {interval_sec}s")
    print(f"[*] Service Account: {cred_path} (exists: {os.path.exists(cred_path)})")
    if db_url:
        print(f"[*] Database URL: {db_url}")
    print("=" * 65)

    last_timestamps = {}

    while True:
        try:
            discovered = ENGINE.scan_all_trackers()
            has_changes = False

            for tr in discovered:
                p = tr["path"]
                mtime = os.path.getmtime(p) if os.path.exists(p) else 0
                if last_timestamps.get(p) != mtime:
                    has_changes = True
                    last_timestamps[p] = mtime

            if has_changes:
                print(f"\n[{time.strftime('%H:%M:%S')}] Detected modification in Excel trackers. Parsing & syncing to Firebase...")
                payload = load_local_payload()
                
                # Try Admin SDK first
                if os.path.exists(cred_path):
                    sync_via_firebase_admin(payload, cred_path)
                elif db_url:
                    sync_via_firebase_rest(payload, db_url)
                else:
                    print(f"[{time.strftime('%H:%M:%S')}] Parsed {payload['executive_kpis']['total_records_tracked']} records. (Provide serviceAccountKey.json or database URL to push to Cloud)")

        except KeyboardInterrupt:
            print("\n[*] Firebase sync stopped.")
            break
        except Exception as e:
            print(f"[!] Watch loop error: {e}")

        time.sleep(interval_sec)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync live Excel trackers to Firebase Cloud")
    parser.add_argument("--watch", action="store_true", help="Run continuous background sync daemon")
    parser.add_argument("--cred", default="serviceAccountKey.json", help="Path to serviceAccountKey.json")
    parser.add_argument("--db-url", default=None, help="Firebase Realtime Database URL")
    parser.add_argument("--interval", type=int, default=4, help="Watch interval in seconds")

    args = parser.parse_args()

    if args.watch:
        run_watch_loop(args.interval, args.cred, args.db_url)
    else:
        print("[*] Running 1-time Firebase sync...")
        payload = load_local_payload()
        if os.path.exists(args.cred):
            sync_via_firebase_admin(payload, args.cred)
        elif args.db_url:
            sync_via_firebase_rest(payload, args.db_url)
        else:
            print(f"[INFO] Parsed {payload['executive_kpis']['total_records_tracked']} records from {len(payload['trackers'])} trackers successfully.")
            print("[TIP] To push to Firebase Cloud, place 'serviceAccountKey.json' in this folder or pass --db-url.")

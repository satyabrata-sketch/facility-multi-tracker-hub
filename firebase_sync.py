import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
import warnings

# Suppress harmless openpyxl data validation warnings
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

from tracker_engine import TrackerEngine, get_file_meta

WORKSPACE_ROOT = os.path.dirname(os.path.abspath(__file__))
ENGINE = TrackerEngine(WORKSPACE_ROOT)

def load_local_payload():
    """Extract full consolidated dataset from all Excel files via non-locking binary stream."""
    payload = ENGINE.get_full_payload()
    # Also keep data.js updated
    try:
        data_js_path = os.path.join(WORKSPACE_ROOT, "data.js")
        with open(data_js_path, "w", encoding="utf-8") as f:
            f.write("window.EMBEDDED_TRACKER_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n")
    except Exception as e:
        sys.stderr.write(f"[!] Warning: could not write data.js: {e}\n")
    return payload

def get_config_from_js():
    """Try to extract firebase configuration from firebase-config.js if available."""
    cfg_path = os.path.join(WORKSPACE_ROOT, "firebase-config.js")
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                content = f.read()
                import re
                proj_match = re.search(r'projectId:\s*["\']([^"\']+)["\']', content)
                db_match = re.search(r'databaseURL:\s*["\']([^"\']+)["\']', content)
                return {
                    "projectId": proj_match.group(1) if proj_match else None,
                    "databaseURL": db_match.group(1) if db_match else None
                }
        except Exception:
            pass
    return {}

def sync_via_firebase_admin(payload: dict, cred_path: str = "serviceAccountKey.json"):
    """
    Sync payload directly to Firebase Cloud Firestore using firebase-admin SDK.
    Handles large datasets by chunking sheets if needed.
    """
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred_full_path = os.path.join(WORKSPACE_ROOT, cred_path) if not os.path.isabs(cred_path) else cred_path
        if not os.path.exists(cred_full_path):
            print(f"[!] Service account key file not found at: {cred_full_path}")
            return False

        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_full_path)
            firebase_admin.initialize_app(cred)

        db = firestore.client()
        
        # 1. Update live executive summary document
        db.collection("facility_trackers").document("executive_summary").set(payload["executive_kpis"])
        
        # 2. Update each tracker document individually (with chunking for large datasets)
        for tid, tdata in payload["trackers"].items():
            if tdata.get("status") != "ok":
                db.collection("facility_trackers").document(f"tracker_{tid}").set(tdata)
                continue

            raw_bytes = len(json.dumps(tdata, ensure_ascii=False).encode("utf-8"))
            # If smaller than 600 KB, save directly
            if raw_bytes < 600 * 1024:
                db.collection("facility_trackers").document(f"tracker_{tid}").set(tdata)
            else:
                # Chunk sheets to guarantee safety under Firestore's 1MB limit
                sheets = tdata.get("data", {}).get("sheets", {})
                chunked_tdata = {
                    "meta": tdata.get("meta", {}),
                    "record_count": tdata.get("record_count", 0),
                    "open_count": tdata.get("open_count", 0),
                    "status": "ok",
                    "is_chunked": True,
                    "data": {
                        "analytics": tdata.get("data", {}).get("analytics", {}),
                        "sheets_manifest": {}
                    }
                }

                for sname, sdata in sheets.items():
                    headers = sdata.get("headers", [])
                    rows = sdata.get("rows", [])
                    chunk_size = 350
                    total_chunks = (len(rows) + chunk_size - 1) // chunk_size if rows else 1

                    chunked_tdata["data"]["sheets_manifest"][sname] = {
                        "headers": headers,
                        "total_rows": len(rows),
                        "total_chunks": total_chunks
                    }

                    for c_idx in range(total_chunks):
                        start = c_idx * chunk_size
                        end = min(start + chunk_size, len(rows))
                        chunk_rows = rows[start:end]
                        chunk_doc_id = f"tracker_{tid}_{sname}_chunk_{c_idx}"
                        db.collection("facility_trackers").document(chunk_doc_id).set({
                            "tracker_id": tid,
                            "sheet_name": sname,
                            "chunk_index": c_idx,
                            "rows": chunk_rows
                        })

                db.collection("facility_trackers").document(f"tracker_{tid}").set(chunked_tdata)

        # 3. Save full snapshot manifest to trigger real-time listener on all clients
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
    """
    if not database_url or "your-project-id" in database_url:
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

def run_watch_loop(interval_sec: int = 3, cred_path: str = "serviceAccountKey.json", db_url: str = None):
    """Continuously monitor Excel files and auto-sync to Firebase on change."""
    print("=" * 70)
    print("   🔥 Facility Multi-Tracker Firebase Cloud Continuous Sync Daemon")
    print("=" * 70)
    print(f"[*] Workspace Root: {WORKSPACE_ROOT}")
    print(f"[*] Polling interval: {interval_sec}s")
    
    cred_full_path = os.path.join(WORKSPACE_ROOT, cred_path) if not os.path.isabs(cred_path) else cred_path
    has_cred = os.path.exists(cred_full_path)
    print(f"[*] Service Account Key: {cred_path} (Detected: {'YES' if has_cred else 'NO - Place serviceAccountKey.json in this folder'})")
    
    if not db_url:
        js_cfg = get_config_from_js()
        db_url = js_cfg.get("databaseURL")

    if db_url and "your-project-id" not in db_url:
        print(f"[*] Realtime DB URL: {db_url}")
    print("=" * 70)
    print("[*] Initializing baseline tracker snapshot...")
    
    # Baseline load
    cached_payload = load_local_payload()
    if os.path.exists(cred_full_path):
        sync_via_firebase_admin(cached_payload, cred_full_path)
    print("\n[*] 🟢 LIVE WATCHER RUNNING. Watching for Excel edits or new files...")
    print("[*] Keep this window open. When you edit any Excel file and press Ctrl+S,")
    print("    it will instantly reflect on your Vercel link worldwide in real time!\n")

    last_fingerprints = {}
    for tr in ENGINE.scan_all_trackers():
        p = tr["path"]
        mtime = os.path.getmtime(p) if os.path.exists(p) else 0
        h = tr.get("meta", {}).get("hash", "")
        last_fingerprints[p] = f"{mtime}_{h}"

    while True:
        try:
            discovered = ENGINE.scan_all_trackers()
            modified_trackers = []

            for tr in discovered:
                p = tr["path"]
                mtime = os.path.getmtime(p) if os.path.exists(p) else 0
                h = tr.get("meta", {}).get("hash", "")
                fp = f"{mtime}_{h}"
                if last_fingerprints.get(p) != fp:
                    last_fingerprints[p] = fp
                    modified_trackers.append(tr)

            if modified_trackers:
                for tr in modified_trackers:
                    rel_p = tr.get("relative_path", os.path.basename(tr["path"]))
                    print(f"\n[{time.strftime('%H:%M:%S')}] ⚡ Excel change detected: {rel_p}")
                
                # Re-parse and push
                cached_payload = load_local_payload()
                rec_count = cached_payload['executive_kpis']['total_records_tracked']
                tr_count = len(cached_payload['trackers'])
                print(f"[{time.strftime('%H:%M:%S')}] Parsed {rec_count:,} records across {tr_count} trackers.")

                if os.path.exists(cred_full_path):
                    sync_via_firebase_admin(cached_payload, cred_full_path)
                elif db_url and "your-project-id" not in db_url:
                    sync_via_firebase_rest(cached_payload, db_url)
                else:
                    print(f"[{time.strftime('%H:%M:%S')}] Snapshot updated locally in 'data.js'.")

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
    parser.add_argument("--interval", type=int, default=3, help="Watch interval in seconds")

    args = parser.parse_args()

    if args.watch:
        run_watch_loop(args.interval, args.cred, args.db_url)
    else:
        print("[*] Running 1-time sync...")
        payload = load_local_payload()
        cred_full_path = os.path.join(WORKSPACE_ROOT, args.cred) if not os.path.isabs(args.cred) else args.cred
        if os.path.exists(cred_full_path):
            sync_via_firebase_admin(payload, cred_full_path)
        elif args.db_url and "your-project-id" not in args.db_url:
            sync_via_firebase_rest(payload, args.db_url)
        else:
            print(f"[INFO] Parsed {payload['executive_kpis']['total_records_tracked']} records from {len(payload['trackers'])} trackers.")
            print("[INFO] Updated 'data.js' snapshot successfully.")
            print("[TIP] To push to Firebase Cloud, place 'serviceAccountKey.json' in this folder.")

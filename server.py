import os
import io
import sys
import json
import time
import socket
import urllib.parse
import warnings
from http.server import HTTPServer, BaseHTTPRequestHandler

# Suppress harmless openpyxl data validation warnings
warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

from tracker_engine import TrackerEngine, get_file_meta

PORT = 8080
WORKSPACE_ROOT = os.path.dirname(os.path.abspath(__file__))
ENGINE = TrackerEngine(WORKSPACE_ROOT)

# In-memory cache for parsed data to make API responses blazing fast (<5ms)
CACHE = {
    "data": None,
    "last_check": 0,
    "file_timestamps": {}
}

def is_cache_valid() -> bool:
    """Check if any tracker file has been modified since last parse."""
    if CACHE["data"] is None:
        return False
    discovered = ENGINE.scan_all_trackers()
    for tr in discovered:
        fpath = tr["path"]
        curr_mtime = os.path.getmtime(fpath) if os.path.exists(fpath) else 0
        if CACHE["file_timestamps"].get(fpath) != curr_mtime:
            return False
    return True

def get_cached_or_fresh_data():
    """Returns cached payload or re-parses if Excel file was modified."""
    if is_cache_valid():
        return CACHE["data"]
    
    # Refresh cache
    payload = ENGINE.get_full_payload()
    timestamps = {}
    for tr in ENGINE.scan_all_trackers():
        fpath = tr["path"]
        timestamps[fpath] = os.path.getmtime(fpath) if os.path.exists(fpath) else 0
    
    CACHE["data"] = payload
    CACHE["file_timestamps"] = timestamps
    CACHE["last_check"] = time.time()

    # Also persist data.js for standalone file:// offline opening
    try:
        data_js_path = os.path.join(WORKSPACE_ROOT, "data.js")
        with open(data_js_path, "w", encoding="utf-8") as f:
            f.write("window.EMBEDDED_TRACKER_DATA = " + json.dumps(payload, ensure_ascii=False) + ";")
    except Exception as e:
        sys.stderr.write(f"Warning: could not write data.js: {e}\n")

    return payload

class TrackerRequestHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # 1. API: Live Status & Fast Heartbeat
        if path == "/api/status":
            try:
                discovered = ENGINE.scan_all_trackers()
                status_list = []
                for tr in discovered:
                    meta = get_file_meta(tr["path"])
                    status_list.append({
                        "id": tr["id"],
                        "title": tr["title"],
                        "path": tr["relative_path"],
                        "modified_time": meta.get("modified_time"),
                        "modified_timestamp": meta.get("modified_timestamp"),
                        "size": meta.get("size_formatted"),
                        "hash": meta.get("hash")
                    })
                
                resp = {
                    "status": "online",
                    "timestamp": time.time(),
                    "datetime": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "trackers": status_list
                }
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(resp).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 1.5. API: Force Fresh Sync of All Excel Files + Cloud Broadcast
        if path == "/api/sync":
            try:
                CACHE["data"] = None
                data = get_cached_or_fresh_data()
                try:
                    import firebase_sync
                    firebase_sync.sync_via_firebase_admin(data)
                except Exception as fb_err:
                    sys.stderr.write(f"[!] Firebase sync on /api/sync: {fb_err}\n")

                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 2. API: Full Data Payload (KPIs + Analytics + Table Data)
        if path == "/api/data":
            try:
                data = get_cached_or_fresh_data()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        # 3. Static data.js
        if path == "/data.js":
            file_to_serve = os.path.join(WORKSPACE_ROOT, "data.js")
            if os.path.exists(file_to_serve):
                with open(file_to_serve, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # 4. API: Download Excel File Safely
        if path.startswith("/api/download/"):
            tracker_id = path.replace("/api/download/", "").strip()
            discovered = ENGINE.scan_all_trackers()
            target = next((tr for tr in discovered if tr["id"] == tracker_id), None)
            
            if target and os.path.exists(target["path"]):
                try:
                    with open(target["path"], "rb") as f:
                        file_bytes = f.read()
                    filename = os.path.basename(target["path"])
                    
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                    self.send_header("Content-Length", str(len(file_bytes)))
                    self.end_headers()
                    self.wfile.write(file_bytes)
                    return
                except Exception as e:
                    self.send_response(500)
                    self.send_cors_headers()
                    self.send_header("Content-Type", "text/plain")
                    self.end_headers()
                    self.wfile.write(f"Error reading file: {e}".encode("utf-8"))
                    return
            else:
                self.send_response(404)
                self.send_cors_headers()
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Tracker file not found")
                return

        # 5. Static Files (index.html, etc.)
        if path == "/" or path == "/index.html":
            file_to_serve = os.path.join(WORKSPACE_ROOT, "index.html")
            if os.path.exists(file_to_serve):
                with open(file_to_serve, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # Fallback 404
        self.send_response(404)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"404 Not Found")

    def log_message(self, format, *args):
        """Clean minimal logging."""
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} {args[1]} {args[2]}\n")

def find_available_port(start_port=8080):
    port = start_port
    while port < start_port + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("localhost", port)) != 0:
                return port
            port += 1
    return start_port

def run():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    port = find_available_port(PORT)
    server_address = ("", port)
    httpd = HTTPServer(server_address, TrackerRequestHandler)
    print("=" * 60)
    print("[*] Facility Tracker Live Web Application Server Started")
    print(f"[*] Local Web App URL: http://localhost:{port}")
    print("[*] Auto-Syncing Excel trackers safely without file locking")
    print(f"[*] Workspace: {WORKSPACE_ROOT}")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server stopped.")

if __name__ == "__main__":
    run()

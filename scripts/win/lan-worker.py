#!/usr/bin/env python3
"""
HP OMEN Direct LAN Worker Client
Connects directly to the Mac Commander HTTP Bridge (http://192.168.100.203:8080)
Zero git friction, instant task streaming, and GPU execution telemetry.
"""

import os
import sys
import time
import json
import socket
import shutil
import urllib.request
import urllib.error
import subprocess
from datetime import datetime, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MAC_BRIDGE_URL = "http://192.168.100.203:8080"
SINGLE_INSTANCE_PORT = 48199
LOG_FILE = os.path.join(REPO_ROOT, "lan-worker.log")

# Unified unbuffered logger: writes to console (if present) and appends to lan-worker.log
class DualLogger:
    def __init__(self, filepath):
        self.terminal = sys.stdout
        self.log = open(filepath, "a", encoding="utf-8", buffering=1)

    def write(self, message):
        if self.terminal:
            try:
                self.terminal.write(message)
            except Exception:
                pass
        try:
            self.log.write(message)
        except Exception:
            pass

    def flush(self):
        if self.terminal:
            try:
                self.terminal.flush()
            except Exception:
                pass
        try:
            self.log.flush()
        except Exception:
            pass

if sys.platform == "win32":
    try:
        if sys.stdout is not None:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr is not None:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Attach dual logger
sys.stdout = DualLogger(LOG_FILE)
sys.stderr = sys.stdout

# CLI override for bridge URL if needed
for arg in sys.argv[1:]:
    if arg.startswith("http://") or arg.startswith("https://"):
        MAC_BRIDGE_URL = arg.rstrip("/")

_instance_socket = None
def acquire_instance_lock():
    global _instance_socket
    _instance_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        _instance_socket.bind(("127.0.0.1", SINGLE_INSTANCE_PORT))
        _instance_socket.listen(1)
        return True
    except OSError:
        return False

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def get_gpu_name():
    smi = shutil.which("nvidia-smi")
    if not smi:
        return "NVIDIA GPU (nvidia-smi not in PATH)"
    try:
        out = subprocess.check_output([smi, "--query-gpu=name", "--format=csv,noheader"], text=True)
        return out.strip().splitlines()[0]
    except Exception:
        return "NVIDIA GeForce GTX 1660 Ti"

def http_post(endpoint, payload_dict):
    url = f"{MAC_BRIDGE_URL}{endpoint}"
    data = json.dumps(payload_dict).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_get(endpoint):
    url = f"{MAC_BRIDGE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))

def execute_task(task):
    task_id = task["id"]
    command = task.get("command", "")
    print(f"\n⚡ [{now_iso()}] Claimed Task: {task_id} ({task.get('type')})", flush=True)
    print(f"   Command: {command}", flush=True)

    started_at = now_iso()
    start_time = time.time()

    if not command:
        return {
            "taskId": task_id,
            "status": "failed",
            "error": "Empty command string.",
            "startedAt": started_at,
            "finishedAt": now_iso(),
            "durationSec": 0
        }

    try:
        worker_env = os.environ.copy()
        worker_env["PYTHONIOENCODING"] = "utf-8"
        proc = subprocess.run(
            command,
            shell=True,
            cwd=REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=worker_env
        )
        duration = round(time.time() - start_time, 2)
        success = (proc.returncode == 0)

        result = {
            "taskId": task_id,
            "status": "completed" if success else "failed",
            "returnCode": proc.returncode,
            "stdout": (proc.stdout or "")[-4000:],
            "stderr": (proc.stderr or "")[-4000:],
            "startedAt": started_at,
            "finishedAt": now_iso(),
            "durationSec": duration
        }
        return result
    except Exception as e:
        duration = round(time.time() - start_time, 2)
        return {
            "taskId": task_id,
            "status": "failed",
            "error": str(e),
            "startedAt": started_at,
            "finishedAt": now_iso(),
            "durationSec": duration
        }

def main():
    if not acquire_instance_lock():
        print(f"[{now_iso()}] ⚠️ Another instance of lan-worker is already running (port {SINGLE_INSTANCE_PORT} locked). Exiting cleanly.", flush=True)
        sys.exit(0)

    host_name = socket.gethostname()
    gpu_name = get_gpu_name()

    print("=" * 65, flush=True)
    print("🚀 HP OMEN Direct LAN Worker Client", flush=True)
    print(f"📡 Target Mac Bridge: {MAC_BRIDGE_URL}", flush=True)
    print(f"🖥️  Worker Host:      {host_name}", flush=True)
    print(f"🎮 Dedicated GPU:    {gpu_name}", flush=True)
    print(f"📝 Logging to:       {LOG_FILE}", flush=True)
    print("=" * 65, flush=True)

    # Initial registration
    try:
        http_post("/api/heartbeat", {"host": host_name, "gpu": gpu_name})
        print("✅ Successfully registered with Mac Bridge Server!\n", flush=True)
    except Exception as e:
        print(f"⚠️ Initial registration notice: {e}", flush=True)
        print("   Will continue retrying in background...\n", flush=True)

    heartbeat_tick = 0
    while True:
        try:
            # Send periodic heartbeat every 10 seconds
            if heartbeat_tick % 10 == 0:
                try:
                    http_post("/api/heartbeat", {"host": host_name, "gpu": gpu_name})
                except Exception:
                    pass
            heartbeat_tick += 1

            # Poll for next task
            poll_resp = http_get("/api/next-task")
            if poll_resp.get("hasTask"):
                task = poll_resp["task"]
                result = execute_task(task)

                print(f"🏁 Task {task['id']} finished ({result['status']}) in {result['durationSec']}s", flush=True)
                if result.get("stdout"):
                    print("--- STDOUT ---", flush=True)
                    print(result["stdout"].strip(), flush=True)
                    print("--------------", flush=True)

                # Post back result
                http_post(f"/api/task/{task['id']}/result", result)
                print(f"📤 Result report sent back to Mac Bridge.\n", flush=True)

        except urllib.error.URLError:
            # Server temporarily unreachable or starting up
            pass
        except Exception as e:
            print(f"⚠️ Worker polling exception: {e}", flush=True)

        time.sleep(1)

if __name__ == "__main__":
    main()

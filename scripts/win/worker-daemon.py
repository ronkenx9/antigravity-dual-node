#!/usr/bin/env python3
"""
HP OMEN Background Worker Daemon
Monitors tasks/queue.json, executes compute & render workloads using GPU resources,
and writes structured execution logs to tasks/results/<task_id>.json.
"""

import os
import sys
import time
import json
import subprocess
from datetime import datetime, timezone

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
QUEUE_PATH = os.path.join(REPO_ROOT, "tasks", "queue.json")
RESULTS_DIR = os.path.join(REPO_ROOT, "tasks", "results")

os.makedirs(RESULTS_DIR, exist_ok=True)

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def load_queue():
    if not os.path.exists(QUEUE_PATH):
        return {"version": "1.0", "updatedAt": now_iso(), "tasks": []}
    try:
        with open(QUEUE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Error reading queue.json: {e}", flush=True)
        return None

def save_queue(data):
    data["updatedAt"] = now_iso()
    temp_path = QUEUE_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(temp_path, QUEUE_PATH)

def process_task(task):
    task_id = task["id"]
    command = task.get("command", "")
    print(f"\n⚡ [{now_iso()}] Claimed Task {task_id} ({task.get('type')})", flush=True)
    print(f"   Command: {command}", flush=True)

    started_at = now_iso()
    start_time = time.time()
    
    if not command:
        result = {
            "taskId": task_id,
            "status": "failed",
            "error": "No command specified in task definition.",
            "startedAt": started_at,
            "finishedAt": now_iso(),
            "durationSec": 0
        }
        return False, result

    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        duration = round(time.time() - start_time, 2)
        success = (proc.returncode == 0)

        stdout_text = (proc.stdout or "")[-4000:]
        stderr_text = (proc.stderr or "")[-4000:]

        result = {
            "taskId": task_id,
            "status": "completed" if success else "failed",
            "returnCode": proc.returncode,
            "stdout": stdout_text,
            "stderr": stderr_text,
            "startedAt": started_at,
            "finishedAt": now_iso(),
            "durationSec": duration
        }
        return success, result
    except Exception as e:
        duration = round(time.time() - start_time, 2)
        result = {
            "taskId": task_id,
            "status": "failed",
            "error": str(e),
            "startedAt": started_at,
            "finishedAt": now_iso(),
            "durationSec": duration
        }
        return False, result

def git_sync_pull():
    try:
        subprocess.run(["git", "pull", "--rebase", "origin", "main"], cwd=REPO_ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def git_sync_push(task_id):
    try:
        subprocess.run(["git", "add", "tasks/"], cwd=REPO_ROOT, check=True)
        subprocess.run(["git", "commit", "-m", f"chore(worker): complete task {task_id}"], cwd=REPO_ROOT, check=True)
        subprocess.run(["git", "push", "origin", "main"], cwd=REPO_ROOT, check=True)
    except Exception as e:
        print(f"⚠️ Git push notice: {e}", flush=True)

def run_loop(poll_interval=3, single_run=False, auto_sync=False):
    print(f"🚀 HP OMEN Worker Daemon initialized.", flush=True)
    print(f"📁 Watching: {QUEUE_PATH}", flush=True)
    print(f"⏱️  Poll interval: {poll_interval}s", flush=True)
    if auto_sync:
        print(f"🔄 Auto-sync with GitHub: ENABLED\n", flush=True)
    else:
        print(f"🔄 Auto-sync with GitHub: DISABLED (local queue only)\n", flush=True)

    sync_counter = 0
    while True:
        if auto_sync and (sync_counter % 5 == 0):
            git_sync_pull()
        sync_counter += 1

        queue = load_queue()
        if queue and "tasks" in queue:
            pending_tasks = [t for t in queue["tasks"] if t.get("status") == "pending"]
            if pending_tasks:
                task = pending_tasks[0]
                task["status"] = "in_progress"
                task["worker"] = "hp-omen-gpu"
                task["startedAt"] = now_iso()
                save_queue(queue)

                success, result = process_task(task)

                # Save execution result artifact
                res_path = os.path.join(RESULTS_DIR, f"{task['id']}.json")
                with open(res_path, "w", encoding="utf-8") as f:
                    json.dump(result, f, indent=2)

                # Update queue status
                task["status"] = "completed" if success else "failed"
                task["finishedAt"] = now_iso()
                task["durationSec"] = result.get("durationSec")
                save_queue(queue)

                print(f"🏁 Task {task['id']} finished with status: {task['status']}", flush=True)

                if auto_sync:
                    print("📤 Syncing completed task result to GitHub...")
                    git_sync_push(task["id"])

        if single_run:
            break
        time.sleep(poll_interval)

if __name__ == "__main__":
    is_single = "--single" in sys.argv
    is_sync = "--sync" in sys.argv
    run_loop(poll_interval=3, single_run=is_single, auto_sync=is_sync)

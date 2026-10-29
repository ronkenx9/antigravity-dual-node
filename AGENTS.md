# Agent Operating Guidelines: Dual-Node Antigravity

This guide defines the roles, protocols, and boundaries for Google Antigravity instances operating concurrently across the Mac Commander and the HP OMEN Worker Node.

---

## 1. Node Roles & Boundaries

### 🍎 Mac Antigravity (Role: `commander`)
- **Primary Domain**: Frontend UI, TypeScript/React, UX review, documentation, Git orchestration, media inspection.
- **Hardware Profile**: Apple Silicon (High single-core CPU, fast unified memory, high-res Liquid Retina display, low fan noise).
- **Prohibited Workloads**:
  - Do NOT run heavy, multi-hour 3D rendering (Blender Cycles) locally.
  - Do NOT attempt heavy local CUDA training or FP16 large diffusion models if the OMEN node is reachable.
  - Offload compute tasks to `tasks/queue.json` using `node scripts/mac/dispatch-task.mjs`.

### 🪟 Windows HP OMEN Antigravity (Role: `worker`)
- **Primary Domain**: CUDA acceleration, PyTorch/TensorFlow, Blender Cycles rendering, ComfyUI/Diffusers pipelines, video encoding (NVENC), large game engine builds.
- **Hardware Profile**: High-power multi-core x86 CPU, Dedicated NVIDIA RTX GPU with dedicated VRAM, active liquid/air cooling.
- **Execution Protocol**:
  - Run `scripts/win/worker-daemon.py` or execute batch workloads from `tasks/queue.json`.
  - Save heavy rendered assets directly to the shared SMB volume (`D:\RenderQueue` / `/Volumes/RenderQueue`).
  - Write output reports and telemetry to `tasks/results/<taskId>.json`.

---

## 2. Git & Concurrency Protocol

To prevent merge conflicts and state collisions between simultaneous agents:

1. **Branch Segmentation**:
   - Mac Agent commits to branch: `agent/mac` or `feat/*`
   - Windows Agent commits to branch: `agent/win` or `compute/*`
   - Merges into `main` must pass verification tests (`npm test`).
2. **Safe Pull/Push**:
   - Always run `bash scripts/mac/sync.sh` (or `git pull --rebase origin <branch>`) before pushing.
   - Never force-push (`git push -f`) to shared branches.
3. **Queue File Locking**:
   - Updates to `tasks/queue.json` must be atomic (write to `.tmp` file and rename).
   - Once a task is claimed by the worker, its status is immediately changed to `in_progress`.
   - Results are written into separate files in `tasks/results/` to prevent concurrent edits.

---

## 3. Communication Channel

If an Antigravity agent on one machine needs to hand off instructions to the other machine:
1. Dispatch an item to `tasks/queue.json` with clear arguments.
2. If real-time coordination is required, commit an instruction in `tasks/HANDOFF.md`.

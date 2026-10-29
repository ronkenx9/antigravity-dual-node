# macOS Commander Setup Guide

This guide configures your Mac as the central command station controlling and offloading compute tasks to the HP OMEN.

---

## 1. Remote Display Client: Moonlight

1. Install Moonlight via Homebrew or direct download:
   ```bash
   brew install --cask moonlight
   ```
2. Launch Moonlight. It will automatically discover your HP OMEN running Sunshine on the local network.
3. Click on the OMEN icon. A 4-digit PIN will appear on your Mac screen.
4. Open the Sunshine Web UI on Windows (or via browser at `https://<omen-ip>:47990/pin`), enter the PIN, and pair.
5. In Moonlight Settings on Mac:
   - Resolution: Match your Mac display (e.g., `2560x1600` or `Native`).
   - Frame Rate: `60 FPS` or `120 FPS` (ProMotion).
   - Video Bitrate: `80-100 Mbps` for local gigabit Ethernet.
   - V-Sync: Enabled.

---

## 2. Mount OMEN File Share (SMB)

### Manual Mount
In Finder, press `Cmd + K`, enter:
```text
smb://<OMEN-IP-ADDRESS>/RenderQueue
```
Enter your Windows username and password and choose "Remember this password in my keychain".

### One-Click Script Mount
Edit `.env` in this repository and run:
```bash
bash scripts/mac/mount-omen.sh
```
The share will appear at `/Volumes/RenderQueue`.

---

## 3. Configure SSH for Terminal & VS Code Remote

1. Copy your Mac SSH public key to the OMEN:
   ```bash
   ssh-copy-id <omen-user>@<omen-ip>
   ```
2. Add an entry to your `~/.ssh/config`:
   ```ssh-config
   Host omen
       HostName <omen-ip>
       User <omen-user>
       IdentityFile ~/.ssh/id_ed25519
   ```
3. In VS Code on Mac:
   - Install the **Remote - SSH** extension.
   - Press `Cmd + Shift + P` > `Remote-SSH: Connect to Host...` > `omen`.
   - You can now write and edit code on Mac while executing natively inside Windows or WSL2 with direct CUDA access!

---

## 4. Offloading Jobs via Antigravity

From your Mac terminal or directly from within your Mac Antigravity chat:
```bash
# Dispatch a Blender render to the OMEN GPU:
node scripts/mac/dispatch-task.mjs --type blender-render --command "blender -b /Volumes/RenderQueue/scene.blend -o /Volumes/RenderQueue/frame_#### -a"

# Check worker queue status:
git pull origin main
cat tasks/queue.json
```

# HP OMEN (Windows 11) Setup Guide

This guide walks you through setting up your HP OMEN gaming PC as a high-performance remote compute and render node for your Mac.

---

## 1. BIOS & Power Configuration (Wake-on-LAN)

1. Turn on or restart your HP OMEN and tap `F10` during startup to enter the **OMEN BIOS Setup**.
2. Navigate to **Advanced** > **Power Management Options**.
3. Set **Wake on LAN (WoL)** to **Enabled**.
4. Disable **Fast Startup** in Windows:
   - Open **Control Panel** > **Power Options** > **Choose what the power buttons do**.
   - Click *Change settings that are currently unavailable*.
   - Uncheck **Turn on fast startup (recommended)** and click *Save changes*.
5. In Device Manager:
   - Expand **Network adapters**, right-click your Ethernet adapter (e.g. Realtek or Intel Gigabit), and select **Properties**.
   - Under the **Power Management** tab, check:
     - `Allow this device to wake the computer`
     - `Only allow a magic packet to wake the computer`
   - Under the **Advanced** tab, ensure **Wake on Magic Packet** is **Enabled**.

---

## 2. Low-Latency Remote Display (Sunshine + Virtual Display)

### Step A: Install Virtual Display Driver
To stream your Mac's native aspect ratio (16:10 / Retina resolution) without an active physical monitor:
1. Download **Virtual Display Driver** by MikeTheTech from [GitHub Releases](https://github.com/itsmikethetech/Virtual-Display-Driver/releases).
2. Run the installer and configure a virtual display for `2560x1600` or `3024x1964` at 60Hz or 120Hz.

### Step B: Install Sunshine
1. Download the latest Sunshine installer from [LizardByte Sunshine Releases](https://github.com/LizardByte/Sunshine/releases).
2. Complete installation and launch the **Sunshine Web UI** at `https://localhost:47990`.
3. Set a username and password.
4. Under **Configuration > Audio/Video**, select your NVIDIA NVENC encoder and assign the virtual display output.

---

## 3. Configure Windows File Sharing (SMB)

1. Create a dedicated directory on your fast NVMe drive (e.g., `D:\RenderQueue`).
2. Right-click the folder and select **Properties** > **Sharing** > **Advanced Sharing**.
3. Check **Share this folder**.
4. Set Share Name to `RenderQueue`.
5. Click **Permissions** and grant your Windows user account **Full Control**.
6. Note your Windows Local IP:
   ```cmd
   ipconfig
   ```
   Look for `IPv4 Address` under your active Ethernet adapter.

---

## 4. Install OpenSSH Server on Windows

1. Open PowerShell as Administrator:
   ```powershell
   Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
   Start-Service sshd
   Set-Service -Name sshd -StartupType 'Automatic'
   ```
2. Verify SSH firewall rule:
   ```powershell
   Get-NetFirewallRule -Name *ssh*
   ```

---

## 5. Setup Python, CUDA, & Background Worker

1. Install **Git** and **Python 3.10+** (ensure "Add Python to PATH" is checked).
2. Clone this repository on the OMEN:
   ```cmd
   git clone https://github.com/ronkenx9/antigravity-dual-node.git
   cd antigravity-dual-node
   ```
3. Verify your NVIDIA GPU and CUDA status:
   ```cmd
   python scripts\win\check-gpu.py
   ```
4. Start the background worker daemon to accept offloaded render/compute jobs:
   ```cmd
   python scripts\win\worker-daemon.py
   ```

---

## 6. Install Antigravity on Windows

1. Download and install the Antigravity desktop application / CLI on Windows.
2. Open the cloned `antigravity-dual-node` folder in Antigravity.
3. Switch your working branch to `agent/win`:
   ```cmd
   git checkout -b agent/win
   ```
4. The Windows Antigravity agent can now communicate and execute tasks locally while collaborating with the Mac Commander.

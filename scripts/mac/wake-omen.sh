#!/usr/bin/env bash
# ==============================================================================
# Wake-on-LAN script for HP OMEN
# Sends a magic packet to the OMEN's MAC address across the local subnet.
# ==============================================================================

set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

MAC="${OMEN_MAC_ADDRESS:-AA:BB:CC:DD:EE:FF}"
BROADCAST="${OMEN_BROADCAST_IP:-255.255.255.255}"
PORT="${OMEN_WOL_PORT:-9}"

echo "📡 Sending Wake-on-LAN packet to $MAC (Broadcast: $BROADCAST, Port: $PORT)..."

if command -v wakeonlan &>/dev/null; then
  wakeonlan -i "$BROADCAST" -p "$PORT" "$MAC"
elif command -v wol &>/dev/null; then
  wol -i "$BROADCAST" -p "$PORT" "$MAC"
else
  # Portable bash/python fallback magic packet generator
  python3 - <<EOF
import socket
import re
import sys

mac_str = "$MAC"
clean_mac = re.sub(r'[^a-fA-F0-9]', '', mac_str)
if len(clean_mac) != 12:
    print(f"Error: Invalid MAC address '{mac_str}'", file=sys.stderr)
    sys.exit(1)

data = bytes.fromhex('FF' * 6 + clean_mac * 16)
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
try:
    sock.sendto(data, ("$BROADCAST", int("$PORT")))
    print("Magic packet sent successfully via socket.")
except Exception as e:
    print(f"Failed to send magic packet: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    sock.close()
EOF
fi

echo "Waiting 10 seconds for OMEN network interface to respond..."
sleep 10

if [[ -n "${OMEN_LAN_IP:-}" ]] && ping -c 1 -W 2 "$OMEN_LAN_IP" &>/dev/null; then
  echo "✅ HP OMEN is ONLINE at $OMEN_LAN_IP"
else
  echo "⚠️ HP OMEN is still spinning up or did not respond to ping. Check BIOS WoL settings if cold."
fi

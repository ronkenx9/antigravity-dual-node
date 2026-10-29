#!/usr/bin/env bash
# ==============================================================================
# Mount HP OMEN SMB Share on macOS
# Mounts the remote Windows folder to /Volumes/RenderQueue
# ==============================================================================

set -euo pipefail

ENV_FILE="$(dirname "$0")/../../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

HOST="${OMEN_LAN_IP:-omen.local}"
SHARE="${OMEN_SMB_SHARE:-RenderQueue}"
MOUNT_POINT="${MAC_SMB_MOUNT_POINT:-/Volumes/$SHARE}"
USER="${OMEN_SMB_USER:-hp}"

echo "📂 Connecting to smb://$HOST/$SHARE as $USER..."

if mount | grep -q "$MOUNT_POINT"; then
  echo "✅ Share is already mounted at $MOUNT_POINT"
  exit 0
fi

mkdir -p "$MOUNT_POINT" 2>/dev/null || true

# Check if osascript mount volume is preferred or mount_smbfs
if [[ -n "${OMEN_SMB_PASSWORD:-}" ]]; then
  mount_smbfs "//${USER}:${OMEN_SMB_PASSWORD}@${HOST}/${SHARE}" "$MOUNT_POINT"
else
  osascript -e "mount volume \"smb://${HOST}/${SHARE}\""
fi

echo "✅ Mounted successfully at $MOUNT_POINT"

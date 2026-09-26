#!/usr/bin/env bash
# Pulls the latest commit, rebuilds the image, and swaps the running
# container for a fresh one. Run this from the Unraid terminal after
# a new commit lands: `bash update.sh` (or `./update.sh` if executable).
set -euo pipefail

CONTAINER_NAME="wasteland-net"
IMAGE_NAME="wasteland-net"
HOST_PORT="8282"

cd "$(dirname "$0")"

echo "==> Pulling latest changes..."
git pull

echo "==> Building image..."
docker build -t "$IMAGE_NAME" .

echo "==> Restarting container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true
docker run -d --name "$CONTAINER_NAME" -p "${HOST_PORT}:80" --restart unless-stopped "$IMAGE_NAME"

echo "==> Done. Running at http://<unraid-ip>:${HOST_PORT}"

#!/bin/bash
cd "$(dirname "$0")"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktopが必要です。"
  read -p "Enterで終了"
  exit 1
fi
docker compose up --build

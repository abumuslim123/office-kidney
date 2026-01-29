#!/bin/bash
# Установка Docker Compose v2 (бинарник с GitHub), если пакет docker-compose-plugin недоступен.
# Запуск: chmod +x scripts/install-docker-compose-v2.sh && sudo ./scripts/install-docker-compose-v2.sh

set -e
COMPOSE_VERSION="${DOCKER_COMPOSE_VERSION:-v2.24.0}"
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ARCH="x86_64" ;;
  aarch64) ARCH="aarch64" ;;
  armv7l)  ARCH="armv7" ;;
  *)       echo "Архитектура $ARCH не поддерживается." >&2; exit 1 ;;
esac
PLUGIN_DIR="/usr/local/lib/docker/cli-plugins"
PLUGIN_PATH="${PLUGIN_DIR}/docker-compose"
mkdir -p "$PLUGIN_DIR"

# Имена артефактов в релизах: linux-x86_64 (v2) или Linux-x86_64
for BINARY in "docker-compose-linux-${ARCH}" "docker-compose-Linux-${ARCH}"; do
  URL="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/${BINARY}"
  echo "Пробуем: $URL"
  if curl -sSLf "$URL" -o "$PLUGIN_PATH" 2>/dev/null; then
    chmod +x "$PLUGIN_PATH"
    echo "Установлено: $PLUGIN_PATH"
    docker compose version
    exit 0
  fi
done
echo "Ошибка: не удалось скачать бинарник. Проверьте https://github.com/docker/compose/releases" >&2
exit 1

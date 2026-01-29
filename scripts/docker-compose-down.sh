#!/bin/bash
# Остановка стека Kidney Office (для systemd)

cd "$(dirname "$0")/.."

COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif [ -x /usr/local/bin/docker-compose ]; then
  COMPOSE_CMD="/usr/local/bin/docker-compose"
elif [ -x /usr/bin/docker-compose ]; then
  COMPOSE_CMD="/usr/bin/docker-compose"
fi
if [ -z "$COMPOSE_CMD" ]; then
  echo "Ошибка: не найден docker-compose или docker compose." >&2
  exit 1
fi

exec $COMPOSE_CMD -f docker/docker-compose.prod.yml --env-file .env.production down "$@"

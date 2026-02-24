#!/bin/bash
# Пересборка стека Kidney Office на продакшене.
# Всегда использует docker-compose.prod.yml и .env.production — не использовать docker-compose.yml на сервере.

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "Ошибка: файл .env.production не найден. Создайте его из .env.production.example и заполните секреты." >&2
  exit 1
fi

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
  echo "Ошибка: не найден docker compose или docker-compose." >&2
  exit 1
fi

exec $COMPOSE_CMD -f docker/docker-compose.prod.yml --env-file .env.production up -d --build

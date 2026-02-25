#!/bin/bash
# Пересборка контейнеров для локальной разработки (docker-compose.yml).

set -e
cd "$(dirname "$0")/.."

COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi
if [ -z "$COMPOSE_CMD" ]; then
  echo "Ошибка: не найден docker compose или docker-compose." >&2
  exit 1
fi

[ -f .env ] || { echo "Создайте .env из .env.example"; exit 1; }

echo "Пересборка образов (--no-cache)..."
$COMPOSE_CMD -f docker/docker-compose.yml --env-file .env build --no-cache

echo "Запуск контейнеров..."
$COMPOSE_CMD -f docker/docker-compose.yml --env-file .env up -d

echo "Готово."

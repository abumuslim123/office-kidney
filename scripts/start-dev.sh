#!/bin/bash
# Локальная разработка: поднять БД, применить миграции, подсказки по backend/frontend.
# Запускать из корня: ./scripts/start-dev.sh

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Создан .env из .env.example. Для Docker добавьте JWT_ACCESS_SECRET и JWT_REFRESH_SECRET."
fi
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "Создан backend/.env из backend/.env.example."
fi

echo "=== 1. Запуск PostgreSQL (Docker) ==="
COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
fi
if [ -n "$COMPOSE_CMD" ]; then
  $COMPOSE_CMD -f docker/docker-compose.yml --env-file .env up -d postgres
  echo "Ожидание готовности PostgreSQL (5 сек)..."
  sleep 5
else
  echo "Docker не найден. Запустите PostgreSQL локально (порт 5432, БД kidney_office)."
fi

echo ""
echo "=== 2. Миграции (backend) ==="
(cd backend && npm run migration:run 2>/dev/null) || echo "Миграции уже применены или выполните вручную: cd backend && npm run migration:run"

echo ""
echo "=== 3. Запуск приложения ==="
echo "В одном терминале:  cd backend && npm run start:dev"
echo "В другом терминале:  cd frontend && npm run dev"
echo ""
echo "Фронт: http://localhost:5173  (прокси /api -> http://localhost:3000)"
echo "Бэкенд: http://localhost:3000"

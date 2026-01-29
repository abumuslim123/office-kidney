#!/bin/bash
# Диагностика: почему «Web server is down» (521)
# Запуск из корня проекта: ./scripts/check-status.sh

cd "$(dirname "$0")/.."
echo "=== 1. Контейнеры ==="
./scripts/docker-compose-up.sh ps 2>/dev/null || true
echo ""
echo "=== 2. Кто слушает 80 и 443 ==="
ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' || netstat -tlnp 2>/dev/null | grep -E ':80 |:443 ' || echo "Порты 80/443 не заняты или нет прав смотреть"
echo ""
echo "=== 3. Последние логи Caddy ==="
./scripts/docker-compose-up.sh logs --tail=30 caddy 2>/dev/null || true
echo ""
echo "=== 4. Последние логи frontend ==="
./scripts/docker-compose-up.sh logs --tail=15 frontend 2>/dev/null || true
echo ""
echo "=== 5. Последние логи backend ==="
./scripts/docker-compose-up.sh logs --tail=15 backend 2>/dev/null || true
echo ""
echo "Если контейнеры не running — пересоберите: ./scripts/docker-compose-up.sh up -d --build"
echo "Если используете Cloudflare: SSL/TLS -> режим «Flexible» (до сервера по HTTP, порт 80)."

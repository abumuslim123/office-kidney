#!/bin/bash
# Установка systemd-юнита и запуск стека Kidney Office
# Запускать из корня проекта: ./scripts/install-and-start.sh
# Потребуется пароль sudo для копирования юнита и systemctl.

set -e
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

if [ ! -f .env.production ]; then
  echo "Создайте .env.production из .env.production.example и заполните секреты."
  exit 1
fi

echo "=== 1. Установка systemd-юнита (автозапуск при перезагрузке) ==="
sed "s|/home/kidney/kidney-office|$PROJECT_ROOT|g" docker/kidney-office.service > /tmp/kidney-office.service
sudo cp /tmp/kidney-office.service /etc/systemd/system/kidney-office.service
sudo systemctl daemon-reload
sudo systemctl enable kidney-office
echo "Юнит установлен и включён."

echo ""
echo "=== 2. Запуск стека (Caddy, PostgreSQL, backend, frontend) ==="
chmod +x scripts/docker-compose-up.sh scripts/docker-compose-down.sh
if ! scripts/docker-compose-up.sh up -d --build; then
  echo ""
  if scripts/docker-compose-up.sh version >/dev/null 2>&1; then
    echo "Ошибка: нет доступа к Docker (permission denied)."
    echo "Добавьте себя в группу docker и перезайдите в консоль:"
    echo "  sudo usermod -aG docker $USER"
    echo "  newgrp docker"
    echo "После этого снова запустите: ./scripts/install-and-start.sh"
    echo ""
    echo "Либо запустите шаг 2 с sudo (один раз):"
    echo "  sudo scripts/docker-compose-up.sh up -d --build"
  else
    echo "Ошибка запуска. Нужен Docker Compose v2 (команда: docker compose)."
    echo "Установите бинарник: sudo ./scripts/install-docker-compose-v2.sh"
  fi
  exit 1
fi

echo ""
echo "=== 3. Запуск сервиса systemd (чтобы после перезагрузки всё поднялось само) ==="
sudo systemctl start kidney-office

echo ""
echo "Готово. Через 1–2 минуты откройте: https://kidney-office.srvu.ru"
echo "Логин первого админа — см. SEED_ADMIN_EMAIL и SEED_ADMIN_PASSWORD в .env.production"
echo "Проверка здоровья: curl -s https://kidney-office.srvu.ru/api/health"

# Развёртывание Kidney Office в production (kidney-office.srvu.ru)

## Требования

- Сервер с Docker и Docker Compose
- Домен kidney-office.srvu.ru, направленный на этот сервер (A-запись или CNAME)
- Порты 80 и 443 открыты с интернета (для Caddy и Let's Encrypt)

## Шаги

### 1. Переменные окружения

В корне репозитория:

```bash
cp .env.production.example .env.production
```

Отредактируйте `.env.production`: задайте надёжные пароли и секреты. Обязательно укажите `DOMAIN=kidney-office.srvu.ru` (он нужен Caddy для Let's Encrypt). Рекомендуется сгенерировать JWT-секреты:

```bash
openssl rand -base64 32   # для JWT_ACCESS_SECRET
openssl rand -base64 32   # для JWT_REFRESH_SECRET
```

Файл `.env.production` не должен попадать в git (уже в `.gitignore`).

### 2. Запуск через Docker Compose (production)

Из корня репозитория:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build
```

(Если установлен старый `docker-compose` без пробела, используйте `docker-compose` вместо `docker compose`.)

Команда поднимает:

- **Caddy** — обратный прокси на портах 80 и 443, автоматически получает и обновляет сертификаты Let's Encrypt для домена из `DOMAIN`;
- **PostgreSQL** — без проброса порта наружу;
- **backend** — миграции при старте, healthcheck по `/api/health`;
- **frontend** — Nginx (доступен только изнутри для Caddy).

Проверка: `curl https://kidney-office.srvu.ru/api/health` (после первого запуска Caddy получит сертификат в течение минуты).

### 3. SSL (Let's Encrypt)

SSL уже настроен через **Caddy** в `docker-compose.prod.yml`:

- Caddy слушает 80 и 443, проксирует запросы на контейнер frontend.
- Для домена из переменной `DOMAIN` (по умолчанию `kidney-office.srvu.ru`) Caddy сам запрашивает сертификат Let's Encrypt и продлевает его.
- Сертификаты хранятся в volume `caddy_data` (не теряются при перезапуске).

**Важно:** перед первым запуском домен должен указывать на IP этого сервера (DNS A-запись). Иначе Let's Encrypt не выдаст сертификат.

### 4. Автозапуск при загрузке сервера

Чтобы фронт, бэк и Caddy поднимались после перезагрузки сервера:

1. Убедитесь, что Docker настроен на автозапуск:
   ```bash
   sudo systemctl enable docker
   ```

2. Установите systemd-юнит для Kidney Office:
   ```bash
   sudo cp docker/kidney-office.service /etc/systemd/system/
   sudo nano /etc/systemd/system/kidney-office.service
   ```
   В юните замените `/opt/kidney-office` на фактический путь к проекту (например `/home/user/kidney-office`).

3. Включите и запустите сервис:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable kidney-office
   sudo systemctl start kidney-office
   ```

После перезагрузки сервера контейнеры поднимутся автоматически. Логи: `journalctl -u kidney-office -f`. Остановка стека: `sudo systemctl stop kidney-office`.

### 5. Проверка после деплоя

- Открыть `https://kidney-office.srvu.ru` — должна открыться страница входа.
- `https://kidney-office.srvu.ru/api/health` — ответ `{"status":"ok","db":"up"}`.
- Создать первого администратора (через API или переменные `SEED_ADMIN_EMAIL` и `SEED_ADMIN_PASSWORD` в `.env.production` при первом запуске).

### 6. Обновление

```bash
git pull
docker-compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build
```

Миграции БД выполняются при каждом старте backend (только недостающие).

### 7. Логи и перезапуск

```bash
docker-compose -f docker/docker-compose.prod.yml logs -f
docker-compose -f docker/docker-compose.prod.yml restart backend
```

## Переменные production

| Переменная | Описание |
|------------|----------|
| DOMAIN | Домен для Caddy и Let's Encrypt (например `kidney-office.srvu.ru`) |
| DB_USERNAME, DB_PASSWORD, DB_DATABASE | Подключение к PostgreSQL |
| JWT_ACCESS_SECRET, JWT_REFRESH_SECRET | Секреты для JWT (обязательно сменить) |
| FRONTEND_URL | Origin для CORS, обязательно HTTPS: `https://kidney-office.srvu.ru` |
| SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD | Опционально: первый админ при пустой БД |

В production `NODE_ENV=production` задаётся в docker-compose; при этом отключены TypeORM `synchronize` и включены helmet, trust proxy и запуск миграций при старте.

# Kidney Office

Многофункциональный офисный сервис: авторизация по ролям, пользователи, модули учёта, ИИ-агенты, фоновые сервисы. Домен: kidney-office.srvu.ru

## Стек

- **Backend**: NestJS, TypeORM, PostgreSQL, JWT (access + refresh), Passport
- **Frontend**: React 18, Vite, TypeScript, React Router, Tailwind CSS, Axios
- **Развёртывание**: Docker Compose (PostgreSQL, backend, frontend через Nginx)

## Быстрый старт (локально)

1. Установить Node.js 18+ и PostgreSQL.
2. Клонировать репозиторий и установить зависимости:

```bash
cd kidney-office
npm run backend:install
npm run frontend:install
```

3. Создать БД и настроить `.env` в `backend/` (см. `backend/.env.example`).
4. Запустить PostgreSQL (или `docker-compose -f docker/docker-compose.yml up -d postgres`).
5. Запустить backend и frontend:

```bash
npm run backend:start:dev
# в другом терминале:
npm run frontend:dev
```

6. Открыть http://localhost:5173. Первый пользователь создаётся вручную (например через API или скрипт сидирования).

## Роли (сидируются при старте backend)

| Роль      | slug     | Описание        |
|-----------|----------|-----------------|
| Администратор | admin    | Полный доступ   |
| Руководитель  | manager  | Таблицы, агенты, сервисы |
| Сотрудник     | employee | Ограниченное редактирование |
| Наблюдатель   | viewer   | Только просмотр |

## Создание первого администратора

После первого запуска backend создайте пользователя с ролью `admin` через API (например Postman или curl), получив предварительно список ролей `GET /api/users/roles` и затем `POST /api/users` с телом:

```json
{
  "email": "admin@kidney-office.srvu.ru",
  "password": "secure-password",
  "displayName": "Администратор",
  "roleId": "<id роли admin из GET /api/users/roles>",
  "isActive": true
}
```

Либо добавьте сидирование первого админа по переменной окружения (опционально).

## Развёртывание (Docker)

**Локально / dev:**

```bash
cd kidney-office
cp backend/.env.example backend/.env
# Заполнить JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, FRONTEND_URL
docker-compose -f docker/docker-compose.yml up -d
```

**Production (kidney-office.srvu.ru):**

```bash
cp .env.production.example .env.production
# Заполнить секреты и DOMAIN=kidney-office.srvu.ru
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build
```

- **SSL**: Caddy в том же compose автоматически получает и продлевает сертификаты Let's Encrypt для домена из `DOMAIN`.
- **Автозапуск**: после перезагрузки сервера стек поднимается сам, если настроен systemd-юнит (см. [docs/production.md](docs/production.md) и `docker/kidney-office.service`).

Подробно: [docs/production.md](docs/production.md). Фронт и API доступны по HTTPS; в production — миграции при старте, health `/api/health`, helmet.

## Структура

- `backend/` — NestJS API (auth, users, accounting, agents, services)
- `frontend/` — React SPA (логин, layout, пользователи, заглушки модулей)
- `docker/` — Dockerfile и docker-compose для полного стека

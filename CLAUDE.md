# Kidney Office (Почка Офис)

Корпоративный портал для управления офисом с ролевой авторизацией.
Продакшн: https://kidney-office.srvu.ru

## Стек

- **Backend:** NestJS 10 + TypeORM + PostgreSQL 16
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **TV App:** Android TV (Kotlin)
- **Инфраструктура:** Docker Compose, Caddy (SSL), Nginx

## Структура

```
backend/src/          — NestJS API сервер
frontend/src/         — React SPA
tv-app/               — Android TV приложение
docker/               — Docker Compose (dev + prod), Caddy, Nginx
scripts/              — Скрипты деплоя, бэкапов, сборки APK
docs/                 — Документация
```

## Модули backend (backend/src/)

| Модуль | Путь | Назначение |
|--------|------|-----------|
| Auth | auth/ | JWT аутентификация (access + refresh токены), Passport.js |
| Users | users/ | Пользователи, роли (admin, manager, employee, viewer), права |
| HR | hr/ | Таблицы, папки, календарь событий, публичный шаринг |
| Calls | calls/ | Запись звонков, транскрипция (Yandex SpeechKit, Whisper), темы |
| Processes | processes/ | Бизнес-процессы, версионирование, чеклисты, push-уведомления |
| Resume | resume/ | Загрузка/парсинг резюме, кандидаты, аналитика, Telegram-бот |
| Screens | screens/ | Управление Android TV, видеопотоки, раздача APK |
| Bitrix24 | bitrix24/ | Интеграция с CRM Bitrix24 |
| Settings | settings/ | Настройки приложения |
| Health | health/ | Проверка работоспособности API |

## Frontend страницы (frontend/src/pages/)

Dashboard, Users, HR (HrListView, HrEvents, HrEventsPublic, HrListsPublic),
Calls (CallDetail, CallTopics, CallsSettings), Processes, Resume (Upload, Candidates,
CandidateDetail, Analytics, Archive, Trash), Screens, Bitrix24, Settings, Login

## Роли

- **admin** — полный доступ
- **manager** — AI агенты, сервисы, процессы
- **employee** — ограниченное редактирование
- **viewer** — только чтение

## Запуск локально

```bash
# Docker (рекомендуется)
docker-compose -f docker/docker-compose.yml up -d

# Вручную
npm run backend:install && npm run frontend:install
npm run backend:start:dev   # API: http://localhost:3000/api
npm run frontend:dev        # UI:  http://localhost:5173
```

## Правила

- **Не менять технологический стек.** Используем только то, что уже в проекте: NestJS, TypeORM, PostgreSQL, React, Vite, Tailwind. Не предлагать и не внедрять альтернативные фреймворки, ORM, базы данных или UI-библиотеки.

## Git

- Основная ветка разработки: `develop`
- Продакшн: `main`

# Роли и API

## Роли (сидируются при старте backend)

| slug     | Название        | Описание |
|----------|-----------------|----------|
| admin    | Администратор   | Полный доступ: пользователи, роли, настройки, все модули |
| manager  | Руководитель    | Таблицы учёта, ИИ-агенты, сервисы/задачи |
| employee | Сотрудник       | Ограниченное редактирование, просмотр своих данных |
| viewer   | Наблюдатель     | Только просмотр |

## API (префикс `/api`)

### Авторизация (публичные)

- `POST /auth/login` — вход. Тело: `{ "email": "...", "password": "..." }`. Ответ: `{ accessToken, refreshToken, expiresIn, user }`.
- `POST /auth/refresh` — обновление токена. Тело: `{ "refreshToken": "..." }`.
- `POST /auth/logout` — выход (Bearer). Тело: `{ "refreshToken": "..." }`.

### Пользователи (Bearer, admin — создание/список/обновление)

- `GET /users/roles` — список ролей (любой авторизованный).
- `GET /users` — список пользователей (admin).
- `GET /users/:id` — пользователь по id (admin).
- `POST /users` — создание пользователя (admin). Тело: `{ email, password, displayName?, roleId, isActive? }`.
- `PUT /users/:id` — обновление (admin). Тело: `{ email?, displayName?, roleId?, isActive? }`.
- `POST /users/:id/change-password` — смена пароля (admin или сам пользователь). Тело: `{ currentPassword?, newPassword }` (currentPassword обязателен при смене своего пароля).

### Модули (заглушки)

- `GET /accounting` — учёт (admin, manager, employee, viewer).
- `GET /agents` — ИИ-агенты (admin, manager).
- `GET /services` — сервисы/задачи (admin, manager).

## Домен

Production: `https://kidney-office.srvu.ru`. В конфиге фронта задать `VITE_API_URL=https://kidney-office.srvu.ru/api` при сборке.

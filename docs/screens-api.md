# API «Настройка экранов» для приложения на ТВ

Приложение на телевизоре (APK) использует публичные эндпоинты без авторизации.

## Базовый URL

- Production: `https://kidney-office.srvu.ru/api`
- Локально: `http://localhost:3000/api` (или адрес вашего backend)

## Сценарий работы приложения на ТВ

1. При первом запуске получить или сгенерировать стабильный `deviceId` (например Android ID или UUID в SharedPreferences).
2. Вызвать `POST /api/public/screens/register` с телом `{ "deviceId": "<ваш deviceId>" }`. В ответ придёт `{ "id", "deviceId", "name" }` — экран создан или уже существовал.
3. Периодически (например каждые 30–60 секунд) вызывать `GET /api/public/screens/feed/<deviceId>`. Если для экрана загружено видео, в ответе будет `{ "videoUrl": "https://..." }`. По этому URL стримить видео (например через ExoPlayer на Android). Если видео нет — `{ "videoUrl": null }`.
4. Воспроизводить видео по `videoUrl` в цикле; при смене контента на веб-интерфейсе при следующем запросе feed придёт новый URL.

## Эндпоинты

### POST /api/public/screens/register

Регистрация или обновление экрана по идентификатору устройства.

**Тело (JSON):**

- `deviceId` (string, обязательно) — уникальный идентификатор устройства ТВ.
- `name` (string, необязательно) — имя экрана (можно задать позже в веб-интерфейсе).

**Ответ (200):**

```json
{
  "id": "uuid-экрана",
  "deviceId": "ваш-deviceId",
  "name": "Зал 1"
}
```

Если экран с таким `deviceId` уже есть — возвращается он же, обновляется `lastSeenAt`.

---

### GET /api/public/screens/feed/:deviceId

Получение URL текущего видео для воспроизведения на ТВ.

**Параметры пути:** `deviceId` — тот же идентификатор, что при регистрации.

**Ответ (200):**

- Если для экрана загружено видео:
  ```json
  { "videoUrl": "https://kidney-office.srvu.ru/api/public/screens/video/<screenId>" }
  ```
- Если видео нет:
  ```json
  { "videoUrl": null }
  ```

Приложение должно по `videoUrl` выполнять GET-запрос и воспроизводить поток (video/mp4). При `videoUrl: null` — показывать пустой экран или заставку.

---

### GET /api/public/screens/video/:screenId

Стриминг файла видео. Вызывается по URL из `feed` (то есть `screenId` берётся из ответа feed; в текущей реализации `videoUrl` уже содержит этот путь). Не передавайте произвольные `screenId` — отдаётся только файл, привязанный к данному экрану.

**Заголовки ответа:** `Content-Type: video/mp4`. Тело — бинарный поток.

---

## Примеры запросов (curl)

```bash
# Регистрация
curl -X POST https://kidney-office.srvu.ru/api/public/screens/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"tv-living-room-001"}'

# Получить feed
curl https://kidney-office.srvu.ru/api/public/screens/feed/tv-living-room-001

# Скачать/стримить видео (URL из videoUrl в ответе feed)
curl -O "https://kidney-office.srvu.ru/api/public/screens/video/<screenId>"
```

## Рекомендации для APK

- Сохранять `deviceId` в SharedPreferences (или аналог), чтобы при перезапуске приложения использовать тот же идентификатор.
- Обрабатывать отсутствие сети и повторять запросы feed с интервалом (например 30–60 с).
- Для воспроизведения видео на Android использовать ExoPlayer или аналог с поддержкой HTTP-стриминга.

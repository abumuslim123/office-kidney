# Resume rollout и smoke-проверка

## Feature flag

- **Backend**: `RESUME_MODULE_ENABLED=true|false`
  - если `false`, API `resume` и публичные apply endpoints отключены (`404`)
  - workers `resume-worker` и `resume-telegram-worker` не запускают обработку
- **Frontend**: `VITE_FEATURE_RESUME=true|false`
  - если `false`, маршруты `hr/resume` и `resume/apply` скрыты/отключены

## Миграции и права

Перед включением флага на окружении выполните миграции:

1. `1741000000000-AddResumeModule`
2. `1741000001000-AddResumePermissions`

Права модуля:
- `hr_resume_view`
- `hr_resume_edit`
- `hr_resume_delete`
- `hr_resume_analytics`
- `hr_resume_public_apply_manage`
- `hr_resume_telegram_manage`

## Workers

- AI/processing воркер:
  - `npm run start:resume-worker`
- Telegram ingest воркер:
  - `npm run start:resume-telegram-worker`

Переменные:
- `RESUME_WORKER_INTERVAL_MS`
- `RESUME_WORKER_BATCH_SIZE`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_INGEST_SECRET`
- `TELEGRAM_INGEST_URL`

## Smoke checklist

### Быстрый скрипт

Запуск:

```bash
chmod +x scripts/resume-smoke.sh
SMOKE_LOGIN=admin SMOKE_PASSWORD=your_password ./scripts/resume-smoke.sh
```

Скрипт проверяет:
- login
- create candidate (raw text)
- list/detail endpoints
- notes endpoint
- export endpoint
- analytics endpoint

### Ручная проверка UI

1. Открыть `HR -> Резюме`.
2. Создать кандидата из текста.
3. Загрузить кандидата файлом.
4. Проверить фильтры и пагинацию.
5. Открыть карточку, добавить/удалить заметку, добавить/удалить тег.
6. Проверить экспорт Excel.
7. Проверить публичный маршрут `/resume/apply`.

## Staged rollout

1. **dev**: `RESUME_MODULE_ENABLED=true`, `VITE_FEATURE_RESUME=true`, запуск workers, прогон smoke.
2. **stage**: включить только для тестовой группы пользователей через права (`hr_resume_*`), проверить Telegram канал.
3. **prod canary**: включить feature flag на ограниченной группе ролей.
4. **prod full**: открыть права для целевых ролей HR.


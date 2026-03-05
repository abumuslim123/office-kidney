# Code Reviewer Memory — Kidney Office

## Стек проекта
- NestJS 10 + TypeORM + PostgreSQL 16
- React 18 + TypeScript + Vite + Tailwind
- Миграции: TypeORM, файлы в `backend/src/migrations/`
- Конфиг DataSource: `backend/src/config/typeorm-data-source.ts`
- Порядок миграций: TypeORM сортирует по имени файла (lexicographic), поэтому timestamp в начале имени критичен

## Паттерны и проблемы проекта

### UUID функции — несоответствие
- Проект использует расширение `uuid-ossp` (подключается в `1738166400000-InitialSchema.ts`)
- Старые миграции используют `uuid_generate_v4()` (требует uuid-ossp)
- Новые Resume-миграции частично переключились на `gen_random_uuid()` (встроена в PG 13+)
- Миграция `1741000004000-AddSpecializationsTable.ts` и `1741000006000-AddCandidateScoring.ts` используют `uuid_generate_v4()` — потенциально несогласованно с `1741000000000-AddResumeModule.ts` и `1741000001000-AddResumePermissions.ts`, которые используют `gen_random_uuid()`
- Оба варианта будут работать, но лучше придерживаться одного стиля

### Дублирование timestamp в именах миграций
- Два файла с timestamp `1741000006000`:
  - `1741000006000-AddCandidateScoring.ts`
  - `1741000006000-DoctorTypeToArray.ts`
- TypeORM определяет порядок по имени файла целиком; при одинаковом timestamp порядок непредсказуем
- `DoctorTypeToArray` должна выполняться ПОСЛЕ `AddCandidateScoring`, но это не гарантировано

### Ограничения PostgreSQL по enum
- В PostgreSQL нельзя удалить значение из enum без пересоздания типа
- Миграция `1741000002000-UnifyStatusPipeline.ts` добавляет значения через `ADD VALUE IF NOT EXISTS`, но метод `down()` не откатывает добавленные enum-значения — только переносит данные обратно. Комментарий об этом есть, но риск нужно учитывать при откате

### Деструктивные операции
- `1741000000000-AddResumeModule.ts` (down): использует `DROP TABLE IF EXISTS` — корректно
- `1741000004000-AddSpecializationsTable.ts` (down): использует `DROP TABLE "resume_specializations"` без `IF EXISTS` — упадёт если таблицы нет

## Пользовательские предпочтения
- Отвечать на русском языке
- Комментарии в коде и планы — на русском

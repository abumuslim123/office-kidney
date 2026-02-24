# Настройка экранов — что делать после внедрения

## 1. Пересобрать и перезапустить backend и frontend

Да, нужно пересобрать оба, чтобы подтянуть новый модуль и миграцию.

### Вариант A: Docker (рекомендуется для продакшена)

```bash
cd /home/kidney/kidney-office
docker compose -f docker/docker-compose.yml --env-file .env up -d --build
```

Так пересоберутся и backend, и frontend, и при старте backend выполнит миграцию (таблица `screens` и право «Настройка экранов»).

### Вариант B: Локально без Docker

**Backend:**

```bash
cd backend
npm run build
npm run start
# или для разработки: npm run start:dev
```

Миграции выполняются при старте в production (см. `main.ts`). Если запускаете не в production, миграции не пойдут автоматически — тогда один раз:

```bash
cd backend
npx typeorm migration:run -d src/config/typeorm-data-source.ts
```

**Frontend:**

```bash
cd frontend
npm run build
```

Собранные файлы из `frontend/dist` отдавайте через ваш веб-сервер (Nginx и т.п.).

---

## 2. Проверка в браузере

1. Войдите в систему под пользователем с правом «Настройка экранов» (или под админом — право уже выдано).
2. В меню должен появиться пункт **«Настройка экранов»**.
3. Откройте его — увидите пустой список экранов и короткую инструкцию. После регистрации ТВ через приложение экраны появятся в списке.

---

## 3. Приложение для ТВ (APK)

В репозитории есть проект **`tv-app/`** (Kotlin, Android). При первом запуске на ТВ приложение само регистрирует устройство в «Настройке экранов», держит экран включённым и воспроизводит загруженное видео в цикле.

### Сборка APK

**Вариант 1: через Docker (без установки Android SDK и JDK)**

Из корня репозитория:

```bash
cd tv-app
docker build -f Dockerfile.build -t kidney-tv-build .
docker run --rm -u root -v "$(pwd)":/project -w /project kidney-tv-build ./gradlew assembleRelease --no-daemon
docker run --rm -u root -v "$(pwd)":/project -w /project -v "$(pwd)/../backend/apk":/out kidney-tv-build sh -c '
  keytool -genkeypair -v -keystore /tmp/release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Kidney Office TV"
  /opt/android-sdk/build-tools/34.0.0/apksigner sign --ks /tmp/release.keystore --ks-pass pass:android --key-pass pass:android --out /out/kidney-office-tv.apk app/build/outputs/apk/release/app-release-unsigned.apk
'
```

Подписанный APK окажется в `backend/apk/kidney-office-tv.apk`. Задайте backend’у `SCREENS_APK_PATH=apk/kidney-office-tv.apk` (при запуске из каталога `backend/`).

**Вариант 2: локально (Android SDK и JDK 17)**

1. Откройте папку `tv-app` в Android Studio или выполните: `cd tv-app && ./gradlew assembleRelease`.
2. Неподписанный APK: `tv-app/app/build/outputs/apk/release/app-release-unsigned.apk`.
3. Подпишите (Android Studio: **Build → Generate Signed Bundle / APK** или `apksigner` из build-tools).
4. Положите подписанный файл, например, в `backend/apk/kidney-office-tv.apk`.

### Размещение APK для скачивания со страницы «Настройка экранов»

На странице «Настройка экранов» есть кнопка **«Скачать приложение для ТВ (APK)»**. Файл отдаётся backend’ом, если задана переменная окружения **`SCREENS_APK_PATH`**:

- Укажите полный или относительный путь к подписанному APK (например `./kidney-office-tv.apk` или `/opt/kidney-office/apk/kidney-office-tv.apk`).
- Положите собранный и подписанный `kidney-office-tv.apk` по этому пути.
- Перезапустите backend (или задайте `SCREENS_APK_PATH` при старте).

Если `SCREENS_APK_PATH` не задан или файл по пути отсутствует, по кнопке скачивания будет 404.

**Docker:** при деплое можно монтировать volume с каталогом, где лежит APK, и задать `SCREENS_APK_PATH` в `environment` в `docker-compose` (путь внутри контейнера к смонтированному файлу).

### Другой URL API в приложении

По умолчанию в приложении вшит production URL: `https://kidney-office.srvu.ru/api`. Чтобы собрать APK для другого сервера, при сборке задайте свойство:

```bash
./gradlew assembleRelease -PAPI_BASE_URL=https://your-server.com/api
```

---

## 4. Переменные окружения (по желанию)

Для backend в production можно задать:

- **`SCREENS_VIDEO_DIR`** — каталог для сохранения загруженных видео (по умолчанию `uploads/screens` относительно рабочей директории).
- **`API_BASE_URL`** — полный URL API (например `https://kidney-office.srvu.ru/api`), чтобы в ответе feed для ТВ приходила абсолютная ссылка на видео. Если не задан, в feed будет относительный путь (подходит, если ТВ обращается к тому же хосту).
- **`SCREENS_APK_PATH`** — путь к файлу APK для раздачи на странице «Настройка экранов» (см. выше). Если не задан, кнопка «Скачать приложение для ТВ» вернёт 404.

---

## 5. Краткий чек-лист

- [ ] Пересобрать и перезапустить backend (и при необходимости frontend).
- [ ] Зайти в веб-интерфейс и убедиться, что в меню есть «Настройка экранов».
- [ ] При необходимости выдать право «Настройка экранов» пользователям в разделе «Пользователи».
- [ ] Собрать и подписать APK из `tv-app/`, положить по пути из `SCREENS_APK_PATH` и перезапустить backend, чтобы кнопка «Скачать приложение для ТВ» работала.

# Kidney Office TV

Приложение для Android TV: при первом запуске регистрирует устройство в админке «Настройка экранов», держит экран включённым и воспроизводит загруженное видео в цикле.

## Сборка

В репозитории есть полный Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`), устанавливать Gradle отдельно не нужно. Нужны только **JDK** и **Android SDK** (достаточно Android Studio или command-line tools).

```bash
./gradlew assembleRelease
```

APK: `app/build/outputs/apk/release/app-release-unsigned.apk`. Для установки на устройства подпишите его (Android Studio: Build → Generate Signed Bundle/APK или `apksigner`).

Другой URL API при сборке:

```bash
./gradlew assembleRelease -PAPI_BASE_URL=https://your-server.com/api
```

Подробнее: [../docs/screens-setup.md](../docs/screens-setup.md) и [../docs/screens-api.md](../docs/screens-api.md).

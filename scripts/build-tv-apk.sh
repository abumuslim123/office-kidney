#!/bin/bash
# Сборка и подписание APK для ТВ, результат в backend/apk/kidney-office-tv.apk
# Требуется Docker. Запускать из корня репозитория.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TV_APP="$ROOT/tv-app"
OUT_DIR="$ROOT/backend/apk"
mkdir -p "$OUT_DIR"

echo "Building Docker image (JDK 17 + Android SDK)..."
cd "$TV_APP"
docker build -f Dockerfile.build -t kidney-tv-build .

echo "Building release APK..."
docker run --rm -u root -v "$TV_APP":/project -w /project kidney-tv-build ./gradlew assembleRelease --no-daemon

echo "Signing APK and copying to backend/apk/..."
docker run --rm -u root \
  -v "$TV_APP":/project -w /project \
  -v "$OUT_DIR":/out \
  kidney-tv-build sh -c '
    keytool -genkeypair -v -keystore /tmp/release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Kidney Office TV" 2>/dev/null || true
    /opt/android-sdk/build-tools/34.0.0/apksigner sign --ks /tmp/release.keystore --ks-pass pass:android --key-pass pass:android --out /out/kidney-office-tv.apk /project/app/build/outputs/apk/release/app-release-unsigned.apk
  '

echo "Done: $OUT_DIR/kidney-office-tv.apk"
echo "Set SCREENS_APK_PATH=apk/kidney-office-tv.apk and run backend from backend/ so the download button works."

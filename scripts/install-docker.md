# Установка Docker и Docker Compose

Чтобы собирать и запускать контейнеры (`./scripts/rebuild-local.sh` и т.д.), нужны **Docker** и **Docker Compose**.

---

## macOS

Удобнее всего поставить **Docker Desktop** — в него входят и Docker Engine, и команда `docker compose`.

1. Скачайте установщик: https://www.docker.com/products/docker-desktop/
2. Установите приложение и запустите Docker Desktop.
3. В терминале проверьте:
   ```bash
   docker --version
   docker compose version
   ```
4. При необходимости добавьте себя в группу или включите использование Docker в настройках приложения.

После этого можно запускать `./scripts/rebuild-local.sh`.

---

## Linux (Ubuntu / Debian)

### 1. Docker Engine

```bash
# Установка из репозитория Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Актуальные шаги: https://docs.docker.com/engine/install/ubuntu/

### 2. Docker Compose

Команда `docker compose` (v2) идёт в пакете **docker-compose-plugin**. После установки выше проверьте:

```bash
docker compose version
```

Если плагина нет, можно поставить бинарник вручную:

```bash
chmod +x scripts/install-docker-compose-v2.sh
sudo ./scripts/install-docker-compose-v2.sh
```

### 3. Права на запуск Docker (без sudo)

```bash
sudo usermod -aG docker $USER
# Выйдите из сессии и зайдите снова или выполните:
newgrp docker
```

После установки запускайте пересборку: `./scripts/rebuild-local.sh`.

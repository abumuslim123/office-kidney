# Установка Node.js и npm на Ubuntu

Если при запуске `npm` вы видите `command not found`, установите Node.js одним из способов ниже.

## Способ 1: через NodeSource (рекомендуется, актуальная LTS)

```bash
# Установка Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка
node -v   # должно показать v20.x.x
npm -v
```

## Способ 2: через пакеты Ubuntu

```bash
sudo apt update
sudo apt install -y nodejs npm
```

В Ubuntu 24.04 обычно ставится Node.js 18.x.

## Способ 3: через nvm (без sudo, в домашнюю директорию)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Перезапустите терминал или выполните:
source ~/.bashrc   # или source ~/.profile

nvm install 20
nvm use 20

node -v
npm -v
```

После установки перейдите в проект и установите зависимости:

```bash
cd /home/kidney/kidney-office/backend
npm install
npm run build
```

# Запуск Kidney Office на сервере (сейчас)

Путь к проекту на этом сервере: **/home/kidney/kidney-office**

**Ubuntu 24.04:** старый пакет `docker-compose` (Python) выдаёт ошибку `No module named 'distutils'`. Нужен Docker Compose v2.

Если пакет `docker-compose-plugin` недоступен (unable to locate package), установите бинарник вручную:
```bash
cd /home/kidney/kidney-office
chmod +x scripts/install-docker-compose-v2.sh
sudo ./scripts/install-docker-compose-v2.sh
```
После установки снова запустите: `./scripts/install-and-start.sh`

Файл **.env.production** уже создан с рабочими секретами и первым админом:
- **Логин:** admin@kidney-office.srvu.ru  
- **Пароль:** KidneyOffice2025!  
(при желании смените в `.env.production` и перезапустите стек)

---

## Один раз выполните (на сервере, в терминале):

**Если при запуске стека появляется «permission denied» к Docker** — добавьте пользователя в группу `docker`:
```bash
sudo usermod -aG docker $USER
newgrp docker
```
(либо выйдите из сессии и зайдите снова.) Затем снова запустите скрипт ниже.

```bash
cd /home/kidney/kidney-office
chmod +x scripts/install-and-start.sh
./scripts/install-and-start.sh
```

Скрипт запросит пароль sudo (для установки systemd-юнита), затем поднимет стек. Через 1–2 минуты откройте в браузере:

**https://kidney-office.srvu.ru**

---

## Если скрипт не подходит — по шагам:

```bash
cd /home/kidney/kidney-office

# 1. Юнит systemd (автозапуск при перезагрузке)
sudo cp docker/kidney-office.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kidney-office

# 2. Запуск стека (подойдёт и docker-compose, и docker compose)
./scripts/docker-compose-up.sh up -d --build

# 3. Запомнить автозапуск
sudo systemctl start kidney-office
```

---

## Проверка

- Сайт: https://kidney-office.srvu.ru  
- Здоровье API: `curl -s https://kidney-office.srvu.ru/api/health`  
- Логи: `docker compose -f docker/docker-compose.prod.yml logs -f`

Домен kidney-office.srvu.ru должен указывать на IP этого сервера (A-запись в DNS).

---

**Если сайт показывает «Web server is down» или ошибку 521 (Cloudflare):**

1. Проверьте контейнеры и порты:
   ```bash
   chmod +x scripts/check-status.sh
   ./scripts/check-status.sh
   ```
2. Если контейнеры не в статусе `Up` — пересоберите:
   ```bash
   ./scripts/docker-compose-up.sh down
   ./scripts/docker-compose-up.sh up -d --build
   ```
3. **Cloudflare:** в панели Cloudflare для этого домена: **SSL/TLS** → режим **Flexible** (до вашего сервера трафик идёт по HTTP на порт 80). Убедитесь, что в DNS A-запись указывает на IP сервера и включён прокси (оранжевое облако) или только DNS (серое) — при прокси порт 80 на сервере должен быть открыт.
4. На сервере порты 80 и 443 должны быть открыты: `sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw status`

# Ansible deployment (minimal)

Этот набор скриптов делает только:
- локальную сборку проекта (frontend + backend Next.js)
- остановку сервиса на сервере (если он уже есть)
- полную перезаливку `/opt/forms-editor/current`
- запуск `systemd` сервиса `forms-editor`

Nginx/Caddy здесь не настраиваются.

## Хосты

- `130.49.146.148` (root)
- `89.39.120.19` (root)

## Перед запуском

1. Убедиться, что локально есть файл ключа:
   - `ansible/service-account.json`
2. Spreadsheet ID уже зашит как константа в `ansible/deploy.sh`:
   - `1Q-zzdZcdZuZH6hdyDQHTl6E7LQxXhfbnUkgMCxC8zW0`

## Запуск

```bash
ansible/deploy.sh
```

## Что будет в итоге

- Приложение: `/opt/forms-editor/current`
- Сервис: `forms-editor.service`
- Порт приложения: `127.0.0.1:3000` (слушает только localhost)

Полезные команды на сервере:

```bash
systemctl status forms-editor
journalctl -u forms-editor -f
```

# API (Fastify)

Базовый каркас REST API для проекта. Текущий стек: Node.js (CommonJS), Fastify, zod, pino.

## Быстрый старт

1) Установите зависимости (в каталоге `apps/api/`):

```bash
npm install
```

2) (Опционально) Создайте файл `.env` в каталоге `apps/api/` или установите переменные окружения:

```
# По умолчанию порт 4000, можно не задавать
PORT=4000
# Можно ограничить CORS до конкретного домена панели
CORS_ORIGIN=*
# Уровень логов: fatal|error|warn|info|debug|trace|silent
LOG_LEVEL=info
# NODE_ENV: development|test|production
NODE_ENV=development
```

3) Запуск в режиме разработки:

```bash
npm run dev
```

Сервер поднимется на `http://localhost:4000`. Проверьте:

```bash
curl http://localhost:4000/v1/health
```

Ожидаемый ответ:

```json
{"ok": true, "ts": "..."}
```

## Отдельная база данных для API

API использует собственную БД и собственную Prisma-схему, независимую от бота.

Переменная окружения:

```
API_DATABASE_URL="file:./api.sqlite"
```

Схема находится в `apps/api/prisma/schema.prisma`. Все Prisma-команды выполняйте из каталога `apps/api/`:

```bash
# генерация клиента
npm run prisma:generate

# миграции в dev среде (создаст папку apps/api/prisma/migrations)
npm run prisma:migrate:dev --name init

# просмотр БД
npm run prisma:studio
```

Важно: корневая схема `prisma/schema.prisma` используется только ботом и не содержит OAuth/Session моделей. API хранит OAuth-токены и сессии у себя.

## Структура

- `src/server.js` — инициализация Fastify, CORS, логирование, error handler, запуск сервера
- `src/utils/env.js` — валидация переменных окружения через zod
- `src/routes/v1/health.js` — маршрут `/v1/health`
- `src/routes/v1/auth.js` — OAuth2 login/callback/logout
- `src/routes/v1/me.js` — профиль текущего пользователя
- `src/middlewares/auth.js` — загрузка и проверка сессии
- `src/repos/**` — Prisma и репозитории (oauth, session)

## Дальше по roadmap

- Добавить middleware авторизации (OAuth2/JWT), `routes/v1/auth.js`
- Репозитории и сервисы (Prisma)
- Роуты: `/v1/me`, `/v1/guilds`, `/v1/guilds/:guildId/config` и далее по `docs/api-roadmap.md`

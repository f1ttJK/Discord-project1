# REST API Roadmap

Этот документ описывает план разработки REST API для проекта Discord (бот + API + панель управления). План учитывает существующий стек: `discord.js v14`, Prisma и спецификацию левелинга в `docs/leveling.md`.

## Принципы и требования

- Безопасность по умолчанию: минимальные привилегии, строгая валидация входных данных (zod), защита сессий (HttpOnly, Secure, SameSite), JWT с коротким TTL и ротацией ключей.
- Производительность: кэш LRU/TTL для конфигов гильдий, ретраи с экспоненциальным джиттером на 429, p95 < 150мс при 100 rps.
- Надежность: идемпотентные POST (ключ идемпотентности), грациозное завершение, лимиты по времени и размеру тела запроса.
- Версионирование: namespace `/v1`, контракт через OpenAPI/Swagger.
- Логирование: структурированные логи JSON с полями `level`, `timestamp`, `guildId`, `userId`, `operation`, `latencyMs`.
- Локализация: ответы и ошибки с поддержкой локали (см. `/locales/{lang}.json` при появлении локализаций).

## Структура проекта API (рекомендуемая)

```
apps/api/
  src/
    server.ts
    routes/
      v1/
        auth.ts
        me.ts
        guilds.ts
        guild-config.ts
        leveling.ts
        roles.ts
        audit-log.ts
        health.ts
        metrics.ts
    middlewares/
      auth.ts
      rate-limit.ts
      error-handler.ts
      cors.ts
    schemas/   # zod-схемы
    services/  # бизнес-логика
    repos/     # Prisma-репозитории
    utils/
  openapi/
    schema.yaml
```

## Переменные окружения

- DATABASE_URL
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_REDIRECT_URI
- API_JWT_SECRET (ротация ключей: API_JWT_SECRET, API_JWT_SECRET_PREV)
- SESSION_COOKIE_SECRET
- NODE_ENV, PORT, CORS_ORIGIN, LOG_LEVEL
- Опционально: REDIS_URL, SENTRY_DSN

## Фазы разработки

### Phase 0 — Подготовка (1–2 дня)

- [ ] Инициализировать `apps/api/` (TypeScript + Fastify).
- [ ] Добавить валидацию ENV через zod.
- [ ] Включить централизованный error handler, структурное логирование JSON.
- [ ] Создать `/v1/health` с `200 OK`.

Deliverables:
- Базовый сервер Fastify запускается локально.
- Скрипты `dev`, `start` для API.
- Lint/Typecheck проходят.

Acceptance (DoD):
- `GET /v1/health` возвращает `{"ok": true}`.
- Неверные ENV — процесс не стартует с понятной ошибкой.

---

### Phase 1 — Аутентификация и доступ (2–3 дня)

- [ ] Сессионный слой: cookie-based session (HttpOnly, Secure, SameSite=Lax/Strict).
- [ ] JWT для программного доступа (короткий TTL: ≤ 1ч), рефреш через cookie-сессию.
- [ ] Discord OAuth2: `GET /v1/auth/login`, `GET /v1/auth/callback`, `POST /v1/auth/logout`.
- [ ] Middlewares: `requireAuth`, `requireGuildAccess` (Owner/Admin/Manage Guild), rate limit per IP и per user.

Deliverables:
- Авторизация пользователя через Discord OAuth2.
- Доступ к защищённым эндпоинтам только с валидной сессией/JWT.

Acceptance (DoD):
- Ошибки авторизации возвращают 401/403 с унифицированным JSON-ответом.
- Unit-тесты на middleware и сессии.

---

### Phase 2 — База данных и репозитории (1–2 дня)

- [ ] Расширить `prisma/schema.prisma`:
  - `User`, `Guild`, `GuildMember`, `GuildConfig`, `Sessions`, `AuditLog`.
  - Индексы `(guildId, userId)` на ключевых таблицах.
- [ ] Реализовать репозитории: `UserRepo`, `GuildRepo`, `GuildConfigRepo`, `SessionRepo`, `AuditLogRepo`.
- [ ] Миграции и сиды (минимум необходимых тестовых данных).

Deliverables:
- Миграции применяются локально и в CI.
- Репозитории покрывают CRUD/поисковые операции.

Acceptance (DoD):
- `GET /v1/me` и `GET /v1/guilds` читают корректные данные из БД.
- Тесты репозиториев выполняются.

---

### Phase 3 — Конфигурация гильдии (2 дня)

- [ ] Роуты:
  - `GET /v1/guilds/:guildId` — краткая информация по гильдии.
  - `GET /v1/guilds/:guildId/config` — чтение `GuildConfig`.
  - `PUT /v1/guilds/:guildId/config` — обновление с валидацией zod (leveling, anti-abuse, roleRewards).
- [ ] LRU/TTL кэш для `GuildConfig`.
- [ ] Аудит изменений в `AuditLog`.

Deliverables:
- Чтение/запись конфигурации гильдии через API.
- Идемпотентные обновления, чёткие ошибки валидации.

Acceptance (DoD):
- Профилировка: p95 < 150мс при 100 rps.
- Кэш даёт hit-rate > 80% для повторных чтений конфигов.

---

### Phase 4 — Leveling API (3–4 дня)

- [ ] Таблица `Leveling`: `guildId`, `userId`, `xp`, `level`, `lastMessageAt`, `lastVoiceAt`.
- [ ] Роуты:
  - `GET /v1/guilds/:guildId/leveling/leaderboard?limit&offset`.
  - `GET /v1/guilds/:guildId/leveling/:userId`.
  - `POST /v1/guilds/:guildId/leveling/recalculate` (только для админов).
- [ ] Правила анти-абуза и кривая уровней согласно `docs/leveling.md` (валидация на входе/в сервисах).
- [ ] Пагинация с курсором, индексы БД.

Deliverables:
- Корректный подсчёт XP/Level, консистентность данных.
- Стабильные лидерборды (10k+ записей).

Acceptance (DoD):
- Тесты бизнес-логики (кривая, анти-абуз, границы).
- Нагрузочный smoke-тест на чтение лидерборда.

---

### Phase 5 — Роли-реварды и синхронизация (2 дня)

- [ ] `POST /v1/guilds/:guildId/roles/rewards/sync` — триггер синхронизации ролей.
- [ ] Идемпотентность и повтор при сбое, логирование прогресса в `AuditLog`.
- [ ] Почтение rate limits Discord (очередь с джиттером — выполняется на стороне бота, API триггерит задание).

Deliverables:
- Безопасный запуск синхронизации ролей.

Acceptance (DoD):
- Повторы не приводят к дублям; при прерывании задача может быть возобновлена.

---

### Phase 6 — Модерация и аудит (опционально, 2–3 дня)

- [ ] `GET /v1/guilds/:guildId/audit-log?type&limit` — просмотр журнала действий.
- [ ] Базовые задания модерации (WARN/MUTE/KICK/BAN) — декларативная постановка задач (если нужно).
- [ ] Шифрование чувствительных полей (AES-GCM) на уровне сервиса.

Deliverables:
- Прозрачный аудит действий и событий.

Acceptance (DoD):
- Фильтры и пагинация журнала, корректные разрешения доступа.

---

### Phase 7 — Наблюдаемость и защита (1–2 дня)

- [ ] `/v1/metrics` (Prometheus), дешборды p95/p99, error rate, RPS, hit/miss кэша.
- [ ] CORS, Helmet, CSRF для cookie-сессий, строгие политики заголовков.
- [ ] Circuit breaker/timeouts для внешних вызовов (если появятся).

Deliverables:
- Метрики и улучшенные политики безопасности.

Acceptance (DoD):
- Настроены алерты по SLA.

---

### Phase 8 — Версионирование и документация (1 день)

- [ ] Namespace `/v1`, заголовок `Accept-Version` (при необходимости).
- [ ] OpenAPI/Swagger (автогенерация/сборка), примеры запросов/ответов.
- [ ] Changelog и семантическая версионизация.

Deliverables:
- Полная документация контрактов API.

Acceptance (DoD):
- Swagger/OpenAPI доступен и актуален в CI.

---

### Phase 9 — Деплой и CI/CD (1–2 дня)

- [ ] Dockerfile, Health checks, миграции при старте контейнера.
- [ ] CI: линт, typecheck, тесты, миграции, публикация OpenAPI артефакта.
- [ ] Environments: dev/staging/prod с изолированными секретами.

Deliverables:
- Надёжный деплой и предсказуемые релизы.

Acceptance (DoD):
- Автодеплой на staging, smoke-тесты проходят; процедура отката документирована.

## Эндпоинты (v1)

- Auth: `GET /v1/auth/login`, `GET /v1/auth/callback`, `POST /v1/auth/logout`
- Me: `GET /v1/me`
- Guilds: `GET /v1/guilds`, `GET /v1/guilds/:guildId`
- Guild Config: `GET /v1/guilds/:guildId/config`, `PUT /v1/guilds/:guildId/config`
- Leveling: `GET /v1/guilds/:guildId/leveling/leaderboard`, `GET /v1/guilds/:guildId/leveling/:userId`, `POST /v1/guilds/:guildId/leveling/recalculate`
- Roles: `POST /v1/guilds/:guildId/roles/rewards/sync`
- Audit: `GET /v1/guilds/:guildId/audit-log`
- Health: `GET /v1/health`, Metrics: `GET /v1/metrics`

## Зависимости и параллельные работы

- Параллелить можно: работу над схемой Prisma (Phase 2) и подготовкой каркаса API (Phase 0/1) при согласовании моделей.
- OpenAPI вести начиная с Phase 3, поддерживать в актуальном состоянии.

## Риски и блокеры

- Неподтверждённые модели `GuildConfig` и `Leveling` (свериться с `docs/leveling.md`).
- Решение по кэшу (в памяти vs Redis) и масштабу (требования по гориз. масштабированию).

## Следующие шаги

1) Подтвердить стек: TypeScript + Fastify + namespace `/v1` + OAuth2 + JWT/Session.
2) Выполнить Phase 0: создать каркас API с `/v1/health`, ENV zod, логирование, error handler.
3) Спланировать миграции для Phase 2 и согласовать модели.

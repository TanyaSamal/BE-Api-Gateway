# SPEC.md — Fullstack Enterprise Architecture

> **Версия:** 2.1.0
> **Статус:** `FINAL — PENDING ARCHITECTURAL APPROVAL`
> **Дата:** 2026-11-26
> **Заменяет:** v2.0.0 (добавлен раздел 12 — анализ производительности k6 + Jaeger и реестр узких мест)
> **Область:** монорепозиторий `api-gateway` (NestJS 11 ×2 + Next.js 16 + RabbitMQ + Redis + Prometheus + Grafana + Jaeger)

---

## 1. Назначение и границы

Документ фиксирует (а) фактическое состояние системы по результатам аудита `docker-compose.yml`,
Dockerfile-ов и исходного кода, (б) целевую архитектуру запуска и (в) критерии приёмки,
при выполнении которых система работает как единый организм.

**Метод аудита:** статический анализ `docker-compose.yml`, `Dockerfile.backend`, `apps/web/Dockerfile`,
`prometheus.yml`, `main.ts` обоих сервисов, `redis.module.ts`, `shared.module.ts`, `download-analytics-csv.handler.ts`,
`worker-pool.service.ts`, `next.config.ts`; `docker compose config --quiet` → exit 0 (синтаксис валиден).
**Не выполнялось:** `docker compose up`, поэтому runtime-поведение выведено из кода, а не проверено.

---

## 2. Системный контекст

```
Browser ──HTTP/WS──► web (Next.js :3000)
   │
   └──HTTP/WS (CORS)──► api-gateway (NestJS :3001) ──AMQP──► rabbitmq ──► analytics-service (NestJS :3002 HTTP + RMQ)
                              │  ▲                                              │
                              │  └────── HTTP NDJSON stream (internal) ◄────────┘
                              ├──► redis (cache, Socket.IO adapter)
                              └──► /analytics/metrics ◄── prometheus ◄── grafana
```

| Сервис | Роль | Порт (внутр.) | Публикуется на хост |
| --- | --- | --- | --- |
| `web` | Next.js standalone UI | 3000 | да (3000) |
| `api-gateway` | BFF: REST, WebSocket, CQRS (Tasks), CSV-стрим, 2FA, метрики | 3001 | да (3001) |
| `analytics-service` | Гибрид: RMQ consumer + internal HTTP (`/internal/analytics/stream`) | 3002 | **нет** |
| `rabbitmq` | Брокер (очередь `analytics_queue`, durable) | 5672 / 15672 | только 15672 (UI), локально |
| `redis` | Кэш, Socket.IO Redis adapter | 6379 | **нет** |
| `prometheus` | Сбор метрик | 9090 | да (9090) |
| `grafana` | Дашборды | 3000 | да (3010) |

---

## 3. Результаты аудита Docker Compose

Серьёзность: 🔴 блокирует работу в контейнерах · 🟠 нарушает требования надёжности/изоляции · 🟡 гигиена.

### 3.1. Порядок запуска и healthcheck

| # | Серв. | Находка | Sev |
| --- | --- | --- | --- |
| H1 | `rabbitmq`, `redis` | Healthcheck есть и корректен (`rabbitmq-diagnostics -q ping`, `redis-cli ping`). Нет `start_period` — RabbitMQ стартует 10–30 с, ретраи (5×5 с) на грани. | 🟡 |
| H2 | `api-gateway` | **Нет healthcheck** и нет `/health`. Есть лишь `GET /analytics/ping` без проверки зависимостей. | 🟠 |
| H3 | `analytics-service` | **Нет healthcheck**; порт 3002 жёстко задан в `main.ts`, не берётся из env. | 🟠 |
| H4 | `web` | `depends_on: [api-gateway]` — короткая форма = `service_started`, не `service_healthy`. Нет healthcheck. | 🟠 |
| H5 | `grafana` | `depends_on: [prometheus]` без условия; у `prometheus` нет healthcheck. | 🟠 |
| H6 | `api-gateway` | Не зависит от `analytics-service`, хотя вызывает его по HTTP (CSV) и через RMQ — может принять трафик раньше готовности бэкенда. | 🟠 |
| H7 | все | `restart: always` без healthcheck — оркестратор не знает о нездоровье. Рекомендуется `unless-stopped`. | 🟡 |

### 3.2. Сетевая связность («единый организм»)

| # | Находка | Sev |
| --- | --- | --- |
| N1 | `download-analytics-csv.handler.ts` вызывает `http://localhost:3002/internal/analytics/stream`. В контейнере `localhost` = сам gateway → **CSV-скачивание сломано в Docker**. Нужен `ANALYTICS_INTERNAL_URL=http://analytics-service:3002`. | 🔴 |
| N2 | `prometheus.yml`: target `host.docker.internal:3001` — работает на Docker Desktop (Win/Mac), **не работает на Linux** без `extra_hosts`. Должно быть `api-gateway:3001`. | 🔴 (Linux) |
| N3 | CORS (`main.ts`) и WebSocket (`tasks.gateway.ts`) жёстко `http://localhost:3000`. В любом нелокальном окружении браузер заблокирует запросы. Нужен `CORS_ORIGIN`. | 🟠 |
| N4 | `NEXT_PUBLIC_API_URL` вшивается **на этапе сборки** (`ARG`); в compose захардкожен `http://localhost:3001`. Для браузера значение корректно, но не конфигурируемо без пересборки → `${PUBLIC_API_URL}`. | 🟡 |
| N5 | Единственная default-сеть; нет разделения публичного и внутреннего контуров. | 🟠 |
| N6 | Prometheus скрейпит только gateway; `analytics-service` метрик не отдаёт. | 🟡 |

### 3.3. Изоляция переменных окружения и секретов

| # | Находка | Sev |
| --- | --- | --- |
| E1 | Нет `.env`/`.env.example`; значения inline в compose, включая `guest:guest` и `GF_SECURITY_ADMIN_PASSWORD=admin` в git. | 🟠 |
| E2 | `RABBITMQ_URL` с учётными данными собирается вручную в двух сервисах — дублирование. | 🟡 |
| E3 | Redis без пароля; порт 6379 опубликован на хост. | 🟠 |
| E4 | AMQP-порт 5672 опубликован на хост без необходимости. | 🟠 |
| E5 | Код читает `process.env.*` напрямую с небезопасными fallback (`localhost`, `127.0.0.1`). В production отсутствие переменной должно **падать на старте**, а не тихо подключаться к localhost. Нет схемы валидации env. | 🟠 |
| E6 | Каждый сервис получает только нужные ему переменные; `.dockerignore` исключает `.env*` из контекста сборки. | ✅ |

### 3.4. Образы и сборка

| # | Находка | Sev |
| --- | --- | --- |
| B1 | `prom/prometheus:latest`, `grafana/grafana:latest` — невоспроизводимо. Зафиксировать версии. | 🟡 |
| B2 | `workers/analytics.worker.js` читается через `process.cwd()` (`worker-pool.service.ts`), но `Dockerfile.backend` **не копирует `workers/`** в runner → `heavy-report` упадёт в контейнере. | 🔴 |
| B3 | `npm ci --only=production` устарел → `--omit=dev`; при `webpack: true` необходимость prod-зависимостей проверить (externals). | 🟡 |
| B4 | Один `Dockerfile.backend` для двух сервисов (общий кэш) — приемлемо; `EXPOSE 3001` относится к обоим. | 🟡 |
| B5 | `web`: standalone с `experimental.externalDir` и `libs/shared` вне `apps/web` — Next может положить `server.js` в `apps/web/server.js`. `CMD ["node","server.js"]` подтвердить реальной сборкой. | 🟠 (verify) |
| B6 | Запуск под `USER node` ✅. HEALTHCHECK в образах отсутствует. | 🟡 |
| B7 | Нет лимитов ресурсов и ротации логов (`json-file` растёт бесконечно). | 🟡 |

### 3.5. Сводка

- Корректно: healthcheck брокера и Redis, `service_healthy` для backend → инфраструктура, non-root, multi-stage, `.dockerignore`, named volume RabbitMQ.
- **Блокеры «единого организма» в Docker:** N1, B2, (N2 на Linux), N3 при нелокальном origin.
- Без их устранения `docker compose up` поднимется «зелёным», но CSV-экспорт и heavy-report не заработают.

---


## 4. Целевая топология и порядок запуска

```
rabbitmq (healthy) ┐
redis    (healthy) ┴─► analytics-service (healthy) ─► api-gateway (healthy) ─► web (healthy)
                                                     api-gateway (healthy) ─► prometheus (healthy) ─► grafana (healthy)
```

Правила:
1. Каждый сервис имеет `healthcheck`; **все** `depends_on` используют `condition: service_healthy`.
2. `api-gateway` зависит от `redis`, `rabbitmq` **и** `analytics-service`.
3. `web` зависит от `api-gateway` (healthy).
4. `grafana` зависит от `prometheus` (healthy); `prometheus` — от `api-gateway` (healthy).
5. `start_period` обязателен: RabbitMQ 30 с, NestJS-сервисы 20 с, web 15 с.

### 4.1. Контракты health-эндпоинтов (новые, JSON)

| Сервис | Эндпоинт | Тип | Ответ 200 | Ответ 503 |
| --- | --- | --- | --- | --- |
| api-gateway | `GET /health` | readiness: Redis `PING` + AMQP | `{"status":"ok","checks":{"redis":"up","rabbitmq":"up"}}` | `{"status":"error","checks":{...}}` через глобальный фильтр |
| analytics-service | `GET /health` | readiness: AMQP | `{"status":"ok","checks":{"rabbitmq":"up"}}` | аналогично |
| web | `GET /api/health` (Next route handler) | liveness | `{"status":"ok"}` | — |

`@nestjs/terminus` **отсутствует** в `package.json` — его добавление требует утверждения; альтернатива — собственный `HealthController`
без новых зависимостей. `/health` не должен проходить через `RedisCacheInterceptor` и 2FA.
Команда healthcheck (Alpine/BusyBox): `wget -qO- http://127.0.0.1:<port>/health || exit 1`.

---

## 5. Изоляция окружения

### 5.1. Файлы

| Файл | В git | Содержимое |
| --- | --- | --- |
| `.env.example` | да | Все ключи с безопасными заглушками |
| `.env` | **нет** (`.gitignore` уже покрывает) | Реальные значения окружения |
| `apps/web/.env.local` | нет | Только dev-режим Next; в Docker не используется (`.dockerignore`) |

### 5.2. Матрица переменных (кто что видит)

| Переменная | api-gateway | analytics | web (build) | rabbitmq | redis | grafana |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `PORT` / `ANALYTICS_PORT` | ✔ | ✔ | — | — | — | — |
| `NODE_ENV` | ✔ | ✔ | ✔ | — | — | — |
| `REDIS_HOST/PORT/PASSWORD` | ✔ | ✔ | — | — | ✔ | — |
| `RABBITMQ_USER/PASS` → `RABBITMQ_URL` | ✔ | ✔ | — | ✔ | — | — |
| `ANALYTICS_INTERNAL_URL` | ✔ | — | — | — | — | — |
| `CORS_ORIGIN` | ✔ | — | — | — | — | — |
| `NEXT_PUBLIC_API_URL` | — | — | ✔ (ARG) | — | — | — |
| `GRAFANA_USER/PASSWORD` | — | — | — | — | — | ✔ |

Принцип наименьших привилегий: web **не** получает секретов брокера/Redis; analytics **не** знает про CORS и URL gateway;
`NEXT_PUBLIC_*` — единственные переменные, допустимые в клиентском бандле.

### 5.3. Валидация конфигурации

- На старте каждый сервис валидирует env (class-validator-схема); при отсутствии обязательных переменных — `process.exit(1)` с перечнем ключей.
- Fallback на `localhost` разрешён **только** при `NODE_ENV !== 'production'`.
- Единая точка чтения: `libs/shared` → типизированный `AppConfig` (без `any`).

### 5.4. Сети

```
networks:
  edge:      # web, api-gateway, grafana, prometheus  (публикуемые порты)
  backend:   # api-gateway, analytics-service, rabbitmq, redis, prometheus
```

- `redis`, `analytics-service`, AMQP RabbitMQ — **без `ports:`**, доступны только в `backend`.
- RabbitMQ UI, Prometheus, Grafana публикуются на `127.0.0.1:<port>`, а не на `0.0.0.0`.
- Опция `internal: true` для `backend` отключает исходящий интернет у всей сети — см. вопрос 2 в разделе 11.

---


## 6. Целевой `docker-compose.yml` (эталон для реализации)

> Применяется только после утверждения. Значения — через `${VAR}` из `.env`. Версии образов — ориентиры, зафиксировать актуальные при реализации.

```yaml
name: enterprise-platform

x-backend-env: &backend-env
  NODE_ENV: production
  REDIS_HOST: redis
  REDIS_PORT: 6379
  REDIS_PASSWORD: ${REDIS_PASSWORD:?required}
  RABBITMQ_URL: amqp://${RABBITMQ_USER:?required}:${RABBITMQ_PASS:?required}@rabbitmq:5672

x-logging: &logging
  driver: json-file
  options: { max-size: "10m", max-file: "3" }

services:
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:?required}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS:?required}
    ports: ["127.0.0.1:15672:15672"]
    volumes: [rabbitmq_data:/var/lib/rabbitmq]
    networks: [backend]
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 10s
      retries: 6
      start_period: 30s
    restart: unless-stopped
    logging: *logging

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD:?required}"]
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    networks: [backend]
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \"$$REDIS_PASSWORD\" ping | grep PONG"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    logging: *logging

  analytics-service:
    build: { context: ., dockerfile: Dockerfile.backend }
    command: ["node", "dist/apps/analytics-service/main.js"]
    environment:
      <<: *backend-env
      ANALYTICS_PORT: 3002
    networks: [backend]
    depends_on:
      redis: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3002/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped
    logging: *logging

  api-gateway:
    build: { context: ., dockerfile: Dockerfile.backend }
    command: ["node", "dist/apps/api-gateway/main.js"]
    environment:
      <<: *backend-env
      PORT: 3001
      ANALYTICS_INTERNAL_URL: http://analytics-service:3002
      CORS_ORIGIN: ${CORS_ORIGIN:?required}
    ports: ["3001:3001"]
    networks: [edge, backend]
    depends_on:
      redis: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
      analytics-service: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3001/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped
    logging: *logging


  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${PUBLIC_API_URL:?required}
    ports: ["3000:3000"]
    networks: [edge]
    depends_on:
      api-gateway: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    restart: unless-stopped
    logging: *logging

  prometheus:
    image: prom/prometheus:v2.55.1
    volumes: ["./prometheus.yml:/etc/prometheus/prometheus.yml:ro"]
    ports: ["127.0.0.1:9090:9090"]
    networks: [edge, backend]
    depends_on:
      api-gateway: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:9090/-/healthy"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    logging: *logging

  grafana:
    image: grafana/grafana:11.3.0
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_USER:?required}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:?required}
    ports: ["127.0.0.1:3010:3000"]
    networks: [edge]
    depends_on:
      prometheus: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    logging: *logging

networks:
  edge: {}
  backend: {}

volumes:
  rabbitmq_data: {}
```

### 6.1. `prometheus.yml` (целевой)

```yaml
global:
  scrape_interval: 5s
scrape_configs:
  - job_name: nestjs-api-gateway
    metrics_path: /analytics/metrics
    static_configs:
      - targets: ["api-gateway:3001"]
```

> В эталоне `backend` без `internal: true` (внешний доступ закрыт отсутствием `ports:`). Включение `internal: true` — по решению в разделе 11.

---

## 7. Требования к изменениям кода и образов (для роли Developer)

| ID | Изменение | Закрывает |
| --- | --- | --- |
| C1 | `download-analytics-csv.handler.ts`: URL из `ANALYTICS_INTERNAL_URL` | N1 |
| C2 | `main.ts` gateway + `tasks.gateway.ts`: origin из `CORS_ORIGIN` (список через запятую) | N3 |
| C3 | `analytics-service/main.ts`: порт из `ANALYTICS_PORT` | H3 |
| C4 | `HealthController` в обоих сервисах + `apps/web/src/app/api/health/route.ts` | H2–H4 |
| C5 | `redis.module.ts`: поддержка `REDIS_PASSWORD`; `redis-io.adapter` использует тот же клиент | E3 |
| C6 | `libs/shared`: типизированный `AppConfig` + валидация env, запрет localhost-fallback в production | E5 |
| C7 | `Dockerfile.backend`: `COPY workers ./workers` в runner; `--omit=dev` | B2, B3 |
| C8 | Проверить реальной сборкой путь `server.js` в web-образе; опц. `HEALTHCHECK` в образах | B5, B6 |
| C9 | `.env.example`; обновить `prometheus.yml` (`api-gateway:3001`) | E1, N2 |
| C10 | Метрики analytics-service (опц.) | N6 |

---

## 8. Единые контракты API

- **Формат ошибки** (глобальный `HttpExceptionFilter`, обязателен для всех сервисов):
  ```json
  { "statusCode": 400, "error": "Bad Request", "message": ["title must be a string"], "path": "/tasks", "correlationId": "uuid", "timestamp": "ISO-8601" }
  ```
- Валидация: глобальный `ValidationPipe({ whitelist: true, transform: true })` — есть в gateway; **добавить** в analytics-service.
- Трассировка: `x-correlation-id` проходит browser → gateway → analytics (HTTP и RMQ) → логи; экспонируется через CORS `exposedHeaders` (реализовано).
- Семантические исключения (`NotFoundException`, `BadGatewayException` при недоступности analytics) вместо `throw new Error`.
- Стриминг CSV: типизированный `Readable.fromWeb` (без `as any`), таймаут через `AbortSignal.timeout`.

---


## 9. Выводы предыдущего аудита (v1.0.0) — остаются в силе

- **CQRS:** `TaskController` принимает `@Body('title')` без DTO → ValidationPipe не работает; проверить регистрацию `GetTasksHandler` и токена `TASK_REPOSITORY`.
- **Event Sourcing:** `IEvent.payload: any` нарушает strict typing; `Task.replay()` на пустой истории должен давать 404; неизвестные события — dead-letter, а не `console.warn`; InMemory-хранилища растут неограниченно.
- **Outbox:** `@Interval(500)` не конфигурируем; `PROCESSED` ставится после `emit` без ACK брокера (риск потери/дублей); нужны retry с backoff и DLQ.
- **Streams:** `as any` в `Readable.fromWeb`, ручной `Transfer-Encoding`, нет лимита NDJSON-буфера.
- **Workers:** `new Worker()` на каждый запрос без terminate/reuse; promise не резолвится при exit без сообщения → Worker Pool (min/max, timeout, terminate).
- **Данные (целевое):** `task_events(id, task_id, event_name, payload JSONB, created_at, version)`, `outbox_events(id, event_id, aggregate_id, event_name, payload, status, retry_count, created_at, updated_at)`; PostgreSQL + Prisma. В текущем compose **PostgreSQL отсутствует** — при переходе на Prisma добавить сервис `postgres` (healthy) в `depends_on` gateway.

---

## 10. Критерии приёмки

1. `docker compose config --quiet` → exit 0; `docker compose up -d --build --wait` завершается успехом (все сервисы `healthy`).
2. Порядок: `rabbitmq, redis → analytics-service → api-gateway → web`; остановка `redis` переводит `api-gateway` в `unhealthy`.
3. `docker compose down && up` без ручных действий возвращает систему в `healthy`.
4. Из контейнера gateway `GET http://analytics-service:3002/internal/analytics/stream` отвечает; `GET /analytics/download/csv` из браузера отдаёт CSV.
5. `GET /analytics/heavy-report` выполняется в контейнере (worker-файл присутствует).
6. Prometheus: target `nestjs-api-gateway` в состоянии `UP`; Grafana видит datasource.
7. С хоста **недоступны** `redis:6379`, `analytics-service:3002`, AMQP `5672`; RabbitMQ UI, Prometheus и Grafana слушают только `127.0.0.1`.
8. В репозитории нет паролей: `git grep -nE "guest:guest|admin"` по compose/коду пуст; `.env` не отслеживается.
9. Запуск gateway без `RABBITMQ_URL` при `NODE_ENV=production` завершается ошибкой с понятным сообщением.
10. WebSocket (Socket.IO через Redis adapter) и CORS работают с `CORS_ORIGIN` из окружения.
11. `npm test` и lint проходят; добавлены тесты `HealthController` (200/503) и CORS-конфигурации.

---

## 11. Открытые вопросы к утверждению

1. Добавить `@nestjs/terminus` или реализовать health вручную (без новой зависимости)?
2. Включать ли `internal: true` для сети `backend` (запретит исходящий интернет всем её контейнерам)?
3. Секреты: достаточно `.env` или Docker secrets / внешний vault?
4. Подтвердить переход на PostgreSQL + Prisma в этом же релизе (влияет на compose).
5. Целевая среда (Windows Docker Desktop / Linux) — определяет актуальность N2.

---

## 12. Анализ производительности и узкие места (k6 + Jaeger)

> Добавлено в v2.1.0 по результатам реального прогона нагрузочного теста и трассировки.
> **Метод:** `grafana/k6` (образ `grafana/k6:latest`) в сети `api-gateway_default`, скрипт `load-tests/tasks-load.js`;
> сбор метрик — Jaeger all-in-one (OTLP/HTTP, UI `http://localhost:16686`).
> **Среда:** Docker Desktop, 8 ГБ RAM, 16 vCPU; стек: `api-gateway`, `analytics-service`, `web` (Next.js), `rabbitmq`, `redis`, `prometheus`, `grafana`, `jaeger`.

### 12.1. Профиль нагрузки (k6)

| Параметр | Значение |
| --- | --- |
| Сценарий | 3 стадии: 10с→30 VU, 30с→100 VU, 10с→0 VU (итого 50с) |
| Пороги | `http_req_duration p(95)<500мс`; `http_req_failed{expected:true}<1%` |
| Итерации | 2681 (53.1/с), 0 прервано |
| HTTP-запросы | 8584 (170.1/с) |
| `http_req_duration` | avg 23.45мс · med 3.73мс · p90 32.4мс · **p95 68.28мс** · max 3.02с |
| `iteration_duration` | avg 981мс · p95 1.16с · max 4.17с |
| Проверки (`checks`) | 8584, успех 100% (проверка аналитики допускает 200/429) |
| Ошибки `http_req_failed` | **6.18% (531)** — все это HTTP 429 |
| `rate_limited_429` | 531 (10.5/с) |
| Получено данных | 4.5 МБ |

**Вывод по порогам:** `p95=68мс < 500мс` — ✅ пройден; `expected:true` отказов ≈ 0 — ✅ пройден (429 помечены `expected:false`).
Формально k6 «зелёный», но **6.18% запросов отброшено rate-limiter-ом** (см. B-1) — это скрытый дефект, а не успех.

### 12.2. Трассировка (Jaeger)

Сервисы в Jaeger: `api-gateway`, `analytics-service`. Проанализировано 300 трейсов gateway и 100 — аналитики.

| Операция (api-gateway) | Кол-во | avg, мс | max, мс |
| --- | --- | --- | --- |
| GET /tasks/:id | 29 | 2.54 | 5.36 |
| PATCH /tasks/:id/complete | 38 | 1.57 | 5.02 |
| POST /tasks | 24 | 1.37 | 2.17 |
| GET /analytics/dashboard | 5 | 1.22 | 1.50 |
| Outbox.Save:TaskCompletedEvent | 38 | 0.30 | 4.02 |
| Outbox.Save:TaskCreatedEvent | 24 | 0.12 | 0.75 |

- **Все прикладные спаны — sub-5мс.** Вычислений в запросе практически нет; латентность определяется не CPU, а вспомогательными путями (429, холодный старт, синхронное логирование).
- **`GET /analytics/dashboard` ≈ 1мс и без RMQ-спана** — ответ отдаётся из Redis-кэша (`RedisCacheInterceptor`), кросс-сервисный вызов не выполняется. Кэш работает корректно.
- **`analytics-service` — всего 3 трейса (`tcp.connect`, avg 7.56 / max 11.25мс).** RMQ-consumer почти не задействован (dashboard закэширован, `/analytics/track` в k6 не вызывается); серверные спаны консьюмера в Jaeger почти не попадают.
- **Хвост `max=3.02с` в k6 отсутствует в steady-state трейсах** → эффект холодного старта (инициализация OTel SDK, первое подключение Redis/RMQ, JIT) на первой итерации, а не устойчивое узкое место.
- В логах gateway — редкие `[WARN] Slow Request: POST /tasks - 203мс` (конкуренция за event loop / GC / синхронный `console.log`).

### 12.3. Реестр узких мест (bottlenecks)

Серьёзность: 🔴 критично · 🟠 важно · 🟡 гигиена.

| ID | Узкое место | Доказательство | Sev |
| --- | --- | --- | --- |
| B-1 | **Rate-limiter по IP**: глобальный `ThrottlerGuard` 10 запр./60с на IP; k6 с одного IP → 6.18% 429 | 531 × 429 в k6 | 🔴 |
| B-2 | **In-memory Event Store растёт неограниченно** (массивы `eventLog`/`outboxTable`), `getAllTasks()`/`getEventsByTaskId()` — O(n), без TTL/пагинации → OOM | контейнеры `api-gateway`/`analytics` падали с кодом 137 (SIGKILL/OOM) | 🔴 |
| B-3 | **Outbox `@Interval(500)`**: полный O(n)-скан `outboxTable` каждые 500мс, без лимита пачки, `markAsProcessed` без ACK брокера, без retry/backoff/DLQ | `outbox.processor.ts` | 🟠 |
| B-4 | **Холодный старт / p99-хвост**: первый запрос до 3с (OTel init, connect, JIT) | k6 max 3.02с; `tcp.connect` до 11мс | 🟠 |
| B-5 | **Синхронный `console.log` на горячем пути** (2–3 строки на событие, лог кэша на каждый запрос) | `[WARN] Slow Request`; насыщение stdout | 🟠 |
| B-6 | **`new Worker()` на каждый `/heavy-report`** без пула/terminate/reuse | `worker-pool.service.ts` | 🟠 |
| B-7 | **Один инстанс, single-threaded event loop**; нет горизонтального масштабирования | 170 req/s на 1 процессе (CPU 0.65% — запас есть) | 🟡 |
| B-8 | **Build context 294 МБ** (`COPY . .` тянет `node_modules`/`.next`) → медленные CI-сборки | лог сборки: transferring context 294 МБ | 🟡 |
| B-9 | **Риск кардинальности метрик**: `route.path \|\| request.url` (query в url) | `performance.interceptor.ts` | 🟡 |
| B-10 | **`analytics-service/main.ts` вызывает `initTracing('api-gateway')`** — неверное имя сервиса (в docker перекрывается `OTEL_SERVICE_NAME`) | `main.ts` | 🟡 |

**Главный вывод:** вычислительных узких мест нет (всё sub-5мс). Узкие места — **инфраструктурные и архитектурные**: rate-limiter (B-1), неограниченная память in-memory хранилища (B-2) и вспомогательные пути (outbox, логирование, холодный старт).

### 12.4. Рекомендации (для роли Developer)

| ID | Изменение | Закрывает |
| --- | --- | --- |
| P-1 | Throttler: ключ по `x-user-id` (не IP), лимит/ttl из env, отдельный throttler для `/analytics/*` | B-1 |
| P-2 | Перейти на PostgreSQL + Prisma (раздел 9): `task_events`/`outbox_events`, индексы `(task_id)`, `(status, created_at)`; пагинация в `GetTasksQuery`; read-model вместо полного replay | B-2 |
| P-3 | Outbox: интервал из env, батч + `SELECT ... FOR UPDATE SKIP LOCKED`, ACK после подтверждения брокера, retry с backoff, DLQ | B-3 |
| P-4 | Readiness-gate + warm-up (прогрев соединений), OTel `BatchSpanProcessor`, исключить `/health` из тяжёлой инициализации | B-4 |
| P-5 | Структурированный асинхронный логгер, уровни (info→warn в prod), сэмплирование логов кэша | B-5 |
| P-6 | Worker Pool (min/max, timeout, terminate) — как в разделе 9 | B-6 |
| P-7 | Горизонтальное масштабирование: stateless-инстансы + реплики, cluster/несколько контейнеров; WS через Redis adapter (уже есть) | B-7 |
| P-8 | `.dockerignore`: `node_modules`, `.next`, `dist`, `coverage` | B-8 |
| P-9 | Метрики: только `route.path` (без query), нормализация label | B-9 |
| P-10 | `initTracing` с корректным именем сервиса | B-10 |

### 12.5. Критерии приёмки по производительности (дополнение к разделу 10)

12. `k6` при 100 VU: `p95 < 500мс` и `http_req_failed{expected:true} < 1%` — оба порога зелёные.
13. Доля HTTP 429 ≤ 1% (сейчас 6.18% — до устранения B-1 не выполняется).
14. 10-минутный прого́н без `restart`/OOM (exit 137) у `api-gateway` и `analytics-service`.
15. После warm-up p99 steady-state < 300мс (устранён холодный хвост 3с).
16. В Jaeger присутствуют серверные спаны `analytics-service` (RMQ consumer), прослеживается цепочка gateway→RMQ→analytics.

### 12.6. Открытые вопросы (производительность)

6. Целевой SLA: какой процент 429 допустим и на каком ключе (IP vs user)?
7. Переход на PostgreSQL + Prisma (B-2/P-2) — в этом же релизе?
8. Целевой профиль нагрузки (пиковые RPS, длительность) для финальной приёмки.

---

**Статус:** `FINAL — PENDING ARCHITECTURAL APPROVAL`.
**Следующий шаг:** формальное утверждение; затем разделы 6–7 и 12.4 → роль Developer, раздел 10 и 12.5 → роль Tester.


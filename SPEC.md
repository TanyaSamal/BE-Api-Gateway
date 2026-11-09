# SPEC.md — Enterprise Microservices Architecture

> **Версия:** 1.0.0
> **Статус:** `DRAFT — PENDING ARCHITECTURAL APPROVAL`
> **Дата:** 2026-11-09
> **Нотация:** Enterprise-уровневый аудит и целевой SPEC

---

## 1. Паспорт и зона ответственности

### 1.1. Цель документа

Итоговый архитектурный аудит существующей NestJS Enterprise-системы
(CQRS, Event Sourcing, Outbox, Streams, Workers) и формирование целевого `SPEC.md`.

### 1.2. Аудируемые подсистемы

1. **API Gateway (BFF)** — контекст Tasks и контекст Analytics.
2. **Analytics Service** — гибридный HTTP + RMQ микросервис.

### 1.3. Критерии входа в аудит

Event Store, Outbox, Stream-трансформеры, Worker Pool, Correlation Context.

## 2. Системный контекст и архитектурные принципы

### 2.1. Контекст системы

Клиент → API Gateway → (RabbitMQ → Analytics Service);
Gateway → internal HTTP stream → CSV (трансформеры NDJSON → CSV).

### 2.2. Архитектурные принципы

- Strict JSON REST contracts + глобальная error-handling uniformity.
- CommandBus / QueryBus — асимметричный маршрутизатор CQRS.
- Атомарность записи Event + Outbox в рамках одной транзакции.

## 3. Технологический стек

| Слой | Компонент | Версия |
| --- | --- | --- |
| API | NestJS | 11.x |
| CQRS | @nestjs/cqrs | 11.x |
| Messaging | @nestjs/microservices (RMQ) | 11.x |
| Scheduler | @nestjs/schedule | 12.x |
| Cache | ioredis | 6.x |
| Metrics | prom-client | 15.x |
| Validation | class-validator / class-transformer | 0.15 / 0.5 |

---

## 4. Контекстные границы (Bounded Contexts)

### 4.1. Tasks Context

Команды CreateTask / CompleteTask, Query GetTask, Event Store, Outbox.

### 4.2. Analytics Context

Track events, dashboard, download CSV, Worker Pool, Metrics.

## 5. CQRS — текущее состояние и находки аудита

- CommandBus/QueryBus используются, но TaskController эндпоинты принимают
  `@Body('title')` без DTO — ValidationPipe `whitelist` не применяется.
- GetTasksHandler существует, но не зарегистрирован в `TasksModule`,
  токен `TASK_REPOSITORY` не зарегистрирован в DI-контейнере.

---
## 6. Event Sourcing — текущее состояние и находки аудита

### 6.1. Проектный дизайн (рекомендуемый)

- Aggregate: Task. События: TaskCreatedEvent, TaskCompletedEvent.
- Event Store: Append-Only лог (event_log), запись Event + Outbox в одной транзакции.
- Snapshot-ы агрегата при достижении порога истории.

### 6.2. Найдения аудита

- `IEvent.payload: any` — нарушение strict typing политики разработчика.
- `Task.replay()` выбрасывает ошибку при пустой истории — некорректная
  семантика «task not found» (должен быть not-found, а не 500).
- Неизвестные типы событий отлавливаются только `console.warn` — нужна
  fail-safe стратегия (reject / dead-letter).
- InMemoryEventStore никогда не очищает лог — неограниченный рост памяти.

## 7. Outbox — текущее состояние и находки аудита

### 7.1. Проектный дизайн (рекомендуемый)

- Таблица outbox_events: PENDING → PUBLISH_ACK → PROCESSED;
  RETRY с exponential backoff; DLQ после порога попыток.

### 7.2. Найдения аудита

- `@Interval(500)` — фиксированный интервал, не конфигурируемый.
- Событие помечается PROCESSED сразу после `emit` (fire-and-forget), до
  подтверждения/ACK брокера — риск потери/дублей.

---
## 8. Streams — текущее состояние и находки аудита

### 8.1. Проектный дизайн (рекомендуемый)

- Конвейер: `Readable.fromWeb(response.body)` → NdjsonParseTransform → AnalyticsCsvTransform → Express Response.
- Трансформеры stateful только внутри экземпляра потока; NDJSON buffer + `_flush`.

### 8.2. Найдения аудита

- `Readable.fromWeb(response.body as any)` — нарушение strict typing.
- `throw new Error(...)` вместо семантического HttpException.
- Ручное `res.setHeader('Transfer-Encoding', 'chunked')`.

## 9. Workers — текущее состояние и находки аудита

### 9.1. Проектный дизайн (рекомендуемый)

- Worker Pool с min/max потоками, terminate/reuse, timeout.

### 9.2. Найдения аудита

- `new Worker()` на каждый heavy-task без terminate/reuse → resource churn,
  риск исчерпания пула потоков.
- Promise не резолвится при корректном exit без сообщения.

## 10. Аудит утечек памяти (Streams & Workers)

### 10.1. Потоки (Streams)

- Backpressure: `pipeline` — корректен, утечек нет на этом уровне.
- Риск: NDJSON buffer без cap на размер входного чанка.

### 10.2. Воркеры (Workers)

- Главная риск-линия: Worker per request без terminate → churn потоков.

### 10.3. Процессный уровень

- InMemoryEventStore / InMemoryTaskRepository — неограниченный рост массивов.

---

## 11. Целевой архитектурный план (требует утверждения)

- Event Store → PostgreSQL + Prisma (event_log, snapshots).
- Outbox → ACID + Publisher Confirms + Retry/DLQ.
- Workers → Worker Pool с terminate/reuse.
- Streams → typed web streams, HttpException, таймауты.

---

## 12. Схема данных (итоговая)

- task_events: id, task_id, event_name, payload JSONB, created_at, version.
- outbox_events: id, event_id, aggregate_id, event_name, payload, status, retry_count, created_at, updated_at.

## 13. Риски и открытые вопросы для архитектурного решения

- InMemory-хранилища → замена на PostgreSQL/Prisma.
- Outbox semantics (ACK vs emit).
- Worker lifecycle.
- Stream typing.

## 14. Acceptance criteria (архитектурные)

- Нет утечек: bounded event log, worker terminate/reuse, stream pipeline cleanup.

---

**Статус:** `DRAFT — PENDING ARCHITECTURAL APPROVAL`.

**Следующий шаг:** formal architectural approval of this SPEC before implementation.


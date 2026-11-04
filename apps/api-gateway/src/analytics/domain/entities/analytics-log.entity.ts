/**
 * Domain Entity: Analytics Log
 *
 * Представляет единичный лог события аналитики.
 * Отвечает за инвариантность и валидацию данных на уровне домена.
 */

export class AnalyticsLogId {
  readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('AnalyticsLogId cannot be empty');
    }
    this.value = value;
  }

  equals(other: AnalyticsLogId): boolean {
    return this.value === other.value;
  }
}

export class AnalyticsLog {
  private readonly _id: AnalyticsLogId;
  private readonly _correlationId: string;
  private readonly _action: string;
  private readonly _payload: Record<string, any>;
  private readonly _createdAt: Date;

  constructor(
    id: AnalyticsLogId,
    correlationId: string,
    action: string,
    payload: Record<string, any>,
    createdAt: Date,
  ) {
    this.validateInvariants(correlationId, action, payload);
    this._id = id;
    this._correlationId = correlationId;
    this._action = action;
    this._payload = payload;
    this._createdAt = createdAt;
  }

  private validateInvariants(
    correlationId: string,
    action: string,
    payload: Record<string, any>,
  ): void {
    if (!correlationId || correlationId.trim().length === 0) {
      throw new Error('AnalyticsLog: correlationId is required');
    }
    if (!action || action.trim().length === 0) {
      throw new Error('AnalyticsLog: action is required');
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('AnalyticsLog: payload must be a valid object');
    }
  }

  // Getters
  get id(): AnalyticsLogId {
    return this._id;
  }

  get correlationId(): string {
    return this._correlationId;
  }

  get action(): string {
    return this._action;
  }

  get payload(): Record<string, any> {
    return this._payload;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Преобразование сущности в DTO для передачи через слои
   */
  toPrimitive(): {
    id: string;
    correlationId: string;
    action: string;
    payload: Record<string, any>;
    createdAt: string;
  } {
    return {
      id: this._id.value,
      correlationId: this._correlationId,
      action: this._action,
      payload: this._payload,
      createdAt: this._createdAt.toISOString(),
    };
  }

  /**
   * Фабрика для создания из сырых данных (из БД/API)
   */
  static fromRaw(data: {
    correlationId: string;
    action: string;
    payload: Record<string, any> | string;
    createdAt: string | Date;
  }): AnalyticsLog {
    const id = new AnalyticsLogId(
      `${data.correlationId}-${Date.now()}-${Math.random()}`,
    );

    // Парсим payload если это строка
    const parsedPayload =
      typeof data.payload === 'string'
        ? JSON.parse(data.payload)
        : data.payload;

    const createdAt =
      typeof data.createdAt === 'string'
        ? new Date(data.createdAt)
        : data.createdAt;

    return new AnalyticsLog(
      id,
      data.correlationId,
      data.action,
      parsedPayload,
      createdAt,
    );
  }
}

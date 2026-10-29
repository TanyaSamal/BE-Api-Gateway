import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class CorrelationContextService {
  // Создаем хранилище для контекста запроса
  private static readonly als = new AsyncLocalStorage<Map<string, string>>();

  public run(correlationId: string, callback: () => void): void {
    const store = new Map<string, string>();
    store.set('correlationId', correlationId);
    CorrelationContextService.als.run(store, callback);
  }

  public getCorrelationId(): string | undefined {
    const store = CorrelationContextService.als.getStore();
    return store?.get('correlationId');
  }
}

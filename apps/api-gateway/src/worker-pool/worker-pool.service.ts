import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { resolve } from 'path';

@Injectable()
export class WorkerPoolService {
  /**
   * Запускает задачу в отдельном ОС-потоке (Worker Thread)
   * @param taskData Данные, передаваемые внутрь воркера
   */
  async runHeavyTask(taskData: {
    reportId: string;
    clientName: string;
  }): Promise<any> {
    return new Promise((resolveResult, reject) => {
      const workerPath = resolve(process.cwd(), 'workers/analytics.worker.js');

      const worker = new Worker(workerPath, {
        workerData: taskData, // Данные копируются в изолированную память воркера
      });

      // Успешное выполнение
      worker.on('message', (result) => {
        resolveResult(result);
      });

      // Ошибка в коде воркера
      worker.on('error', (error) => {
        console.error(`[Worker Error]:`, error);
        reject(
          new InternalServerErrorException(
            'Ошибка при расчете задачи в воркере',
          ),
        );
      });

      // Преждевременный выход из потока
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(
            new InternalServerErrorException(
              `Воркер неожиданно завершился с кодом: ${code}`,
            ),
          );
        }
      });
    });
  }
}

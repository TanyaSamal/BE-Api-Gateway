'use client';

import { useState } from 'react';
import { useTrace } from '@/context/TraceContext';
import { API_URL } from '@/lib/api';

export default function PerformancePage() {
  const { sendRequest } = useTrace();

  // Состояние для теста Worker Pool
  const [clientName, setClientName] = useState('Acme Corp');
  const [isHeavyRunning, setIsHeavyRunning] = useState(false);
  const [heavyResult, setHeavyResult] = useState<unknown>(null);
  const [pingResult, setPingResult] = useState<{ latencyMs: number; time: string } | null>(null);

  // Одновременный запуск тяжелой задачи и проверки отзывчивости Event Loop
  const runWorkerPoolTest = async () => {
    setIsHeavyRunning(true);
    setHeavyResult(null);
    setPingResult(null);

    // 1. Запускаем тяжелый отчет в Worker Thread (без await, чтобы не ждать)
    const heavyPromise = sendRequest(
      'GET',
      `/analytics/heavy-report?client=${encodeURIComponent(clientName)}`,
    ).then((res) => {
      setHeavyResult(res);
      setIsHeavyRunning(false);
    });

    // 2. Через 300 мс (когда воркер гарантированно нагружен) проверяем отзывчивость Main Thread
    setTimeout(singlePing, 300);

    await heavyPromise;
  };

  // Одиночный ping для сравнения
  const singlePing = async () => {
    const start = performance.now();
    const res = await sendRequest<{ status: string; timestamp: string }>('GET', '/analytics/ping');
    const latencyMs = Math.round(performance.now() - start);
    if (res) {
      setPingResult({ latencyMs, time: res.timestamp });
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-amber-400">
        Тестирование Node.js Worker Threads и Streams
      </h1>

      {/* Блок 1: Worker Pool vs Event Loop */}
      <section className="border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-800">
            1. Worker Pool (`heavy-report` + параллельный `ping`)
          </h2>
          <p className="text-xs text-slate-400">
            Запускает 3-секундную задачу в отдельном потоке и через 300 мс отправляет{' '}
            <code className="text-amber-300">GET /analytics/ping</code> для проверки, что Event Loop не заблокирован.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Имя клиента..."
            className="border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={runWorkerPoolTest}
            disabled={isHeavyRunning}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {isHeavyRunning ? 'Воркер работает (3 сек)...' : 'Запустить стресс-тест'}
          </button>
          <button
            onClick={singlePing}
            className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg text-sm transition"
          >
            Одиночный Ping
          </button>
        </div>

        {/* Индикатор ответа Ping во время работы тяжелого воркера */}
        {pingResult && (
          <div className="p-3 border border-emerald-800/60 rounded-lg text-xs flex items-center justify-between">
            <span className="text-emerald-800">
              Main Thread отзывчив! Ответ от <code>/analytics/ping</code> получен:
            </span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {pingResult.latencyMs} ms
            </span>
          </div>
        )}

        {/* Результат работы Worker Thread */}
        {heavyResult !== null && (
          <div className="space-y-1">
            <span className="text-xs text-slate-400">Результат из Worker Thread:</span>
            <pre className="bg-slate-950 p-3 rounded-lg text-xs text-amber-200 border border-slate-800 overflow-x-auto">
              {JSON.stringify(heavyResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Блок 2: Потоковое скачивание CSV */}
      <section className="border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-800">
            2. Потоковая генерация CSV (Streams Pipeline + Backpressure)
          </h2>
          <p className="text-xs text-slate-400">
            Запрашивает <code className="text-sky-300">GET /analytics/download/csv</code>. Данные передаются чанками из{' '}
            <code>analytics-service</code> через NDJSON и CSV Transform-стримы напрямую в загрузчик браузера.
          </p>
        </div>

        <div>
          <a
            href={`${API_URL}/analytics/download/csv`}
            download
            className="inline-block bg-sky-600 hover:bg-sky-500 px-5 py-2.5 rounded-lg text-sm font-medium transition"
          >
            Скачать CSV-отчет (Stream)
          </a>
        </div>
      </section>
    </div>
  );
}

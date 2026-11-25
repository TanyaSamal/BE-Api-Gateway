'use client';

import { useEffect, useState } from 'react';
import { useTrace } from '@/context/TraceContext';
import type { IAnalyticsDashboardResponse } from '@shared/interfaces/analytics-response.interface';
import { API_URL, ANALYTICS_INTERNAL_URL } from '@/lib/api';

type AnalyticsPeriod = '7_days' | '30_days';
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export default function AnalyticsPage() {
  const { sendRequest, logs } = useTrace();
  // Состояние для query-параметров GetAnalyticsDashboardDto
  const [userId, setUserId] = useState('1');
  const [period, setPeriod] = useState<AnalyticsPeriod>('7_days');
  const [analytics, setAnalytics] = useState<IAnalyticsDashboardResponse | null>(null);

  // Состояние для Circuit Breaker & Chaos Engineering
  const [circuitState, setCircuitState] = useState<CircuitState>('CLOSED');
  const [isChaosBroken, setIsChaosBroken] = useState(false);
  const [chaosError, setChaosError] = useState<string | null>(null);

  // Состояние для теста Redis Throttler
  const [throttleResults, setThrottleResults] = useState<
    { index: number; ok: boolean; durationMs: number }[]
  >([]);
  const [isThrottlingTestRunning, setIsThrottlingTestRunning] = useState(false);

  const lastAnalyticsLog = logs.find((l) =>
    l.endpoint.startsWith('/analytics/dashboard'),
  );

  // Получение текущего состояния Circuit Breaker
  const fetchCircuitStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/analytics/circuit-status`);
      if (res.ok) {
        const data = await res.json();
        if (data?.state) setCircuitState(data.state);
      }
    } catch {
      // Игнорируем фоновые ошибки опроса
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/analytics/circuit-status`);
        if (res.ok && !isCancelled) {
          const data = await res.json();
          if (data?.state) setCircuitState(data.state);
        }
      } catch {
        // Игнорируем фоновые ошибки опроса
      }
    };

    void loadStatus();
    const interval = setInterval(() => {
      void loadStatus();
    }, 2000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  const fetchDashboard = async (e: React.SubmitEvent) => {
    e.preventDefault();

    const params = new URLSearchParams({ userId: String(Number(userId)), period });

    const endpoint = `/analytics/dashboard?${params.toString()}`;
    const res = await sendRequest<{ success: boolean; data: IAnalyticsDashboardResponse }>('GET', endpoint);

    if (res) {
      setAnalytics(res.data);
    }

    await fetchCircuitStatus();
  };

  // Переключение Chaos-режима на микросервисе аналитики (порт 3002)
  const handleToggleChaos = async () => {
    setChaosError(null);

    try {
      const res = await fetch(
        `${ANALYTICS_INTERNAL_URL}/internal/analytics/chaos`,
        { method: 'POST' },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      setIsChaosBroken(Boolean(data.isBroken));
    } catch {
      setChaosError(
        'Не удалось подключиться к localhost:3002 (проверьте, что порт 3002 открыт и включен app.enableCors() в analytics-service)',
      );
    }
  };

  // Стресс-тест Throttler (12 быстрых запросов -> 429 Too Many Requests)
  const handleRunThrottleTest = async () => {
    setIsThrottlingTestRunning(true);
    setThrottleResults([]);

    for (let i = 1; i <= 12; i++) {
      const start = performance.now();
      const res = await sendRequest('GET', '/analytics/ping');
      const durationMs = Math.round(performance.now() - start);

      setThrottleResults((prev) => [
        ...prev,
        { index: i, ok: res !== null, durationMs },
      ]);
    }

    setIsThrottlingTestRunning(false);
  };

  const circuitBadgeStyle: Record<CircuitState, string> = {
    CLOSED: 'bg-emerald-950 text-emerald-400 border-emerald-700',
    HALF_OPEN: 'bg-amber-950 text-amber-400 border-amber-700',
    OPEN: 'bg-rose-950 text-rose-400 border-rose-700 animate-pulse',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-sky-400">
        Аналитика и производительность (Redis, Streams, Worker Threads, Circuit Breaker, Throttler)
      </h1>

      {/* 1. Управление Circuit Breaker & Chaos Engineering */}
      <div className="p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-600">
              Circuit Breaker (Opossum + Redis Fallback)
            </h2>
            <p className="text-xs text-slate-500">
              Порог: 50% ошибок за 10с → размыкание цепи (OPEN) и мгновенный ответ из Redis
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Circuit State:</span>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${circuitBadgeStyle[circuitState]}`}
            >
              {circuitState}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleToggleChaos}
            className={`px-4 py-2 rounded-lg text-xs font-medium text-white transition ${
              isChaosBroken
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {isChaosBroken
              ? '🔥 Analytics Service СЛОМАН (Нажмите, чтобы починить)'
              : '🛠️ Симулировать падение Analytics Service'}
          </button>
        </div>

        {chaosError && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300">
            {chaosError}
          </div>
        )}
      </div>

      {/* 2. Дашборд и Redis Cache / Fallback */}
      <form onSubmit={fetchDashboard} className="space-y-3 p-4 rounded-xl border border-slate-800">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs text-slate-400 mb-1">User ID (UUID / ID)</label>
            <div className="flex gap-1">
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="w-36">
            <label className="block text-xs text-slate-400 mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
              className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              <option value="7_days">7_days</option>
              <option value="30_days">30_days</option>
            </select>
          </div>

          <div className="flex items-end">
            <button type="submit" className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded-lg text-sm font-medium h-[38px]">
              GET /dashboard
            </button>
          </div>
        </div>

        {/* Вывод ошибки валидации, если DTO не пропустит значение */}
        {lastAnalyticsLog?.status === 'ERROR' && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300 font-mono">
            {lastAnalyticsLog.errorMessage}
          </div>
        )}
      </form>

      {/* Статус скорости последнего запроса */}
      {lastAnalyticsLog?.status === 'SUCCESS' && (
        <div className="text-xs text-slate-400">
          Время ответа (Cache Hit / Miss):{' '}
          <span className="font-mono font-bold text-emerald-400">{lastAnalyticsLog.durationMs} ms</span>
        </div>
      )}

      {analytics !== null && (
        <pre className="p-4 rounded-lg text-xs text-sky-600 border border-slate-800 overflow-x-auto">
          {JSON.stringify(analytics, null, 2)}
        </pre>
      )}

      {/* 3. Тест Distributed Rate Limiting (@nestjs/throttler + Redis) */}
      <div className="p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-600">
              Distributed Rate Limiter (Redis Throttler)
            </h2>
            <p className="text-xs text-slate-500">
              Лимит: 10 запросов за 60с. Отправьте 12 запросов подряд к /analytics/ping для получения 429
            </p>
          </div>

          <button
            type="button"
            disabled={isThrottlingTestRunning}
            onClick={handleRunThrottleTest}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium transition"
          >
            {isThrottlingTestRunning
              ? 'Отправка запросов...'
              : 'Тест Rate Limit (12 запросов)'}
          </button>
        </div>

        {throttleResults.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {throttleResults.map((item) => (
              <div
                key={item.index}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex justify-between ${
                  item.ok
                    ? 'bg-emerald-150/40 border-emerald-800 text-emerald-400'
                    : 'bg-rose-150/60 border-rose-800 text-rose-400'
                }`}
              >
                <span>
                  #{item.index}: {item.ok ? '200 OK' : '429 BLOCK'}
                </span>
                <span className="opacity-75">{item.durationMs}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

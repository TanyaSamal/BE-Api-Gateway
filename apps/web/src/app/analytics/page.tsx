'use client';

import { useState } from 'react';
import { useTrace } from '@/context/TraceContext';
import type { IAnalyticsDashboardResponse } from '@shared/interfaces/analytics-response.interface';

type AnalyticsPeriod = '7_days' | '30_days';

export default function AnalyticsPage() {
  const { sendRequest, logs } = useTrace();
  // Состояние для query-параметров GetAnalyticsDashboardDto
  const [userId, setUserId] = useState('1');
  const [period, setPeriod] = useState<AnalyticsPeriod>('7_days');
  const [analytics, setAnalytics] = useState<IAnalyticsDashboardResponse | null>(null);

  const lastAnalyticsLog = logs.find((l) => l.endpoint === '/analytics/dashboard');

  const fetchDashboard = async (e: React.SubmitEvent) => {
    e.preventDefault();
    
    const params = new URLSearchParams({ userId: String(Number(userId)), period });

    const endpoint = `/analytics/dashboard?${params.toString()}`;
    const res = await sendRequest<{ success: boolean; data: IAnalyticsDashboardResponse }>('GET', endpoint);
    
    if (res) {
      setAnalytics(res.data);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-sky-400">
        Аналитика и производительность (Redis, Streams, Worker Threads)
      </h1>

      {/* 1. Дашборд и Redis Cache */}
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
    </div>
  );
}

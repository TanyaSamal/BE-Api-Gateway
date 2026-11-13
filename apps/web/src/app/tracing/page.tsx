'use client';

import { useTrace } from '@/context/TraceContext';

export default function TracingPage() {
  const { logs, clearLogs } = useTrace();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-400">
          Журнал трассировки (x-correlation-id)
        </h1>
        <button onClick={clearLogs} className="text-xs text-slate-400 hover:text-slate-200">
          Очистить историю
        </button>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border text-slate-400">
            <tr>
              <th className="p-3">Время</th>
              <th className="p-3">Запрос</th>
              <th className="p-3">x-correlation-id</th>
              <th className="p-3">Latency</th>
              <th className="p-3">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="p-3 text-slate-400">{log.timestamp}</td>
                <td className="p-3 font-mono">
                  <span className="text-indigo-400 font-bold">{log.method}</span> {log.endpoint}
                </td>
                <td className="p-3 font-mono text-amber-300 select-all">{log.correlationId}</td>
                <td className="p-3 font-mono">{log.durationMs} ms</td>
                <td className="p-3">{log.status}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Лог пуст. Выполните запросы на страницах «Задачи» или «Аналитика».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

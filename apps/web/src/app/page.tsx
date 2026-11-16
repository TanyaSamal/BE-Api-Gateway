'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTrace } from '@/context/TraceContext';
import type { ITaskResponse } from '@/types/api';
import { API_URL } from '@/lib/api';

interface TaskCompletedWsPayload {
  taskId: string;
  completedAt: string;
  correlationId?: string;
}

export default function TasksPage() {
  const { sendRequest } = useTrace();
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [tasksList, setTasksList] = useState<ITaskResponse[]>([]);
  const [selectedTask, setSelectedTask] = useState<ITaskResponse | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Подключение к WebSocket Gateway и подписка на TaskCompletedEvent
  useEffect(() => {
    const socket: Socket = io(API_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => setIsWsConnected(true));
    socket.on('disconnect', () => setIsWsConnected(false));

    socket.on('task.completed', (payload: TaskCompletedWsPayload) => {
      // 1. Мгновенно обновляем статус задачи в списке без перезагрузки страницы
      setTasksList((prev) =>
        prev.map((task) =>
          task.id === payload.taskId
            ? { ...task, status: 'COMPLETED', completedAt: payload.completedAt }
            : task,
        ),
      );

      // 2. Если эта задача открыта в инспекторе агрегата — обновляем и её
      setSelectedTask((prev) =>
        prev && prev.id === payload.taskId
          ? { ...prev, status: 'COMPLETED', completedAt: payload.completedAt }
          : prev,
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const extractTaskId = (data: unknown): string => {
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (typeof obj.id === 'string' || typeof obj.id === 'number') return String(obj.id);
      if (typeof obj.taskId === 'string' || typeof obj.taskId === 'number') return String(obj.taskId);
      if (obj.data) return extractTaskId(obj.data);
    }
    return '';
  };

  // Создание задачи
   const handleCreate = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const res = await sendRequest<ITaskResponse | string>('POST', '/tasks', { title });
    if (res) {
      const resolvedId = extractTaskId(res);
      const createdTask: ITaskResponse = {
        id: resolvedId,
        title,
        status: 'OPEN',
      };

      setTitle('');
      setTasksList((prev) => [createdTask, ...prev]);
      setSelectedTask(createdTask);
      if (resolvedId) setTaskId(resolvedId);
    }
  };


  // Восстановление состояния агрегата (Task.replay)
  const handleReplay = async (taskId: string | number) => {
    const cleanId = String(taskId ?? '').trim();
    if (!cleanId) return;
    
    const res = await sendRequest<ITaskResponse>('GET', `/tasks/${cleanId}`);
    
    if (res) {
      setSelectedTask(res);
      setTaskId(String(res.id));
    }
  };
  
  // Завершение задачи (отправляем команду — UI обновится по WebSocket от OutboxProcessor!)
  const handleComplete = async (taskId: string | number) => {
    const cleanId = String(taskId ?? '').trim();
    if (!cleanId) return;

    await sendRequest<ITaskResponse>('PATCH', `/tasks/${taskId}/complete`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-emerald-400">
        Задачи (CQRS + Event Sourcing + Outbox + WS)
      </h1>
      <div
        className={`text-xs px-2.5 py-1 rounded-full inline-block font-mono ${
          isWsConnected
            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            : 'bg-rose-950 text-rose-400 border border-rose-800'
        }`}
      >
        {isWsConnected ? '● WS Connected' : '○ WS Disconnected'}
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm">
          POST /tasks
        </button>
      </form>

      {/* Список задач с реактивным обновлением по WebSocket */}
      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-800/50 text-xs font-medium text-slate-900 flex justify-between">
          <span>Список задач (обновляется по событию task.completed из Outbox)</span>
          <span>Всего: {tasksList.length}</span>
        </div>

        <ul className="divide-y divide-slate-800">
          {tasksList.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            return (
              <li
                key={task.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted ? 'line-through text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        isCompleted
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-amber-950 text-amber-400'
                      }`}
                    >
                      {task.status || 'OPEN'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">{task.id}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReplay(task.id)}
                    className="bg-indigo-600/80 hover:bg-indigo-600 px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    Replay
                  </button>
                  {!isCompleted && (
                    <button
                      onClick={() => handleComplete(task.id)}
                      className="bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    >
                      Завершить
                    </button>
                  )}
                </div>
              </li>
            );
          })}

          {tasksList.length === 0 && (
            <li className="p-6 text-center text-xs text-slate-500">
              Создайте первую задачу выше, чтобы протестировать реактивное обновление через WebSocket
            </li>
          )}
        </ul>
      </div>

      {/* Инспектор состояния агрегата (Task.replay) */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder="Task ID..."
            className="flex-1 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={() => handleReplay(taskId)} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg text-sm">
            GET (Replay)
          </button>
        </div>

        {selectedTask !== null && (
          <pre className="p-4 rounded-lg text-xs text-slate-600 border border-slate-800 overflow-x-auto">
            {JSON.stringify(selectedTask, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}


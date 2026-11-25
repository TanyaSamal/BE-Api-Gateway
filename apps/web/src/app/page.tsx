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

interface TaskItem extends Omit<ITaskResponse, 'authorId' | 'isDeleted'> { authorId?: string; isDeleted?: boolean; }

export default function TasksPage() {
  const { sendRequest } = useTrace();
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [tasksList, setTasksList] = useState<ITaskResponse[]>([]);
  const [selectedTask, setSelectedTask] = useState<ITaskResponse | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Состояние текущего пользователя для тестирования CASL ABAC
  const [currentUserId, setCurrentUserId] = useState('user-1');
  const [currentUserRole, setCurrentUserRole] = useState<'user' | 'admin'>('user');
  const [caslFeedback, setCaslFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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
    setCaslFeedback(null);

    const res = await sendRequest<ITaskResponse | string>('POST', '/tasks', { title }, { 'x-user-id': currentUserId });

    if (res) {
      const resolvedId = extractTaskId(res);
      const createdTask: TaskItem = {
        id: resolvedId,
        title,
        status: 'OPEN',
        authorId: currentUserId,
        isDeleted: false,
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
      setTasksList((prev) =>
        prev.map((t) => (t.id === String(res.id) ? { ...t, ...res } : t)),
      );
    }
  };
  
  // Завершение задачи (отправляем команду — UI обновится по WebSocket от OutboxProcessor!)
  const handleComplete = async (taskId: string | number) => {
    const cleanId = String(taskId ?? '').trim();
    if (!cleanId) return;
    setCaslFeedback(null);

    await sendRequest<ITaskResponse>('PATCH', `/tasks/${taskId}/complete`, undefined, { 'x-user-id': currentUserId });
  };

  // Удаление задачи с проверкой прав через CASL Guard
  const handleDelete = async (targetId: string | number) => {
    const cleanId = String(targetId ?? '').trim();
    if (!cleanId) return;
    setCaslFeedback(null);

    const res = await sendRequest<{
      success?: boolean;
      message?: string;
      statusCode?: number;
    }>('DELETE', `/tasks/${cleanId}`, undefined, { 'x-user-id': currentUserId, 'x-user-role': currentUserRole });

    if (res && res.success) {
      setCaslFeedback({
        type: 'success',
        message: `Задача удалена пользователем ${currentUserId} (${currentUserRole})`,
      });
      // Делаем Replay, чтобы получить обновленный агрегат с isDeleted: true
      await handleReplay(cleanId);
    } else {
      setCaslFeedback({
        type: 'error',
        message:
          res?.message ||
          `403 Forbidden: ${currentUserId} (${currentUserRole}) не может удалить эту задачу`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-emerald-400">
            Задачи (CQRS + Event Sourcing + Outbox + WS + CASL)
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
        </div>

        {/* Переключатель активного пользователя и роли для проверки CASL */}
        <div className="flex items-center gap-2 bg-slate-200 border border-slate-800 px-3 py-2 rounded-xl">
          <span className="text-xs text-slate-700">Профиль (CASL):</span>
          <select
            value={`${currentUserId}:${currentUserRole}`}
            onChange={(e) => {
              const [uid, role] = e.target.value.split(':');
              setCurrentUserId(uid);
              setCurrentUserRole(role as 'user' | 'admin');
              setCaslFeedback(null);
            }}
            className="text-xs text-emerald-700 font-mono px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
          >
            <option value="user-1:user">user-1 (role: user)</option>
            <option value="user-2:user">user-2 (role: user)</option>
            <option value="super-admin:admin">super-admin (role: admin)</option>
          </select>
        </div>
      </div>

      {/* Уведомление от CASL Guard */}
      {caslFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-medium ${
            caslFeedback.type === 'error'
              ? 'bg-rose-950/60 border-rose-800 text-rose-300'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
          }`}
        >
          {caslFeedback.message}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Новая задача от имени ${currentUserId}...`}
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
            const isDeleted = Boolean(task.isDeleted);
            return (
              <li
                key={task.id}
                className={`p-4 flex items-center justify-between gap-4 transition ${
                  isDeleted ? 'bg-rose-950/10 opacity-60' : 'hover:bg-slate-800/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted || isDeleted ? 'line-through text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        isDeleted
                          ? 'bg-rose-950 text-rose-400'
                          : isCompleted
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-amber-950 text-amber-400'
                      }`}
                    >
                      {isDeleted ? 'DELETED' : task.status || 'OPEN'}
                    </span>

                    {Boolean(task.authorId) && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        author: {String(task.authorId)}
                      </span>
                    )}
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
                  {!isCompleted && !isDeleted && (
                    <button
                      onClick={() => handleComplete(task.id)}
                      className="bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    >
                      Завершить
                    </button>
                  )}
                  {!isDeleted && (
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    >
                      Удалить
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


'use client';

import { useState } from 'react';
import { useTrace } from '@/context/TraceContext';
import type { ITaskResponse } from '@/types/api';

export default function TasksPage() {
  const { sendRequest } = useTrace();
  const [title, setTitle] = useState('');
  const [taskId, setTaskId] = useState('');
  const [taskData, setTaskData] = useState<ITaskResponse | null>(null);

  const handleCreate = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const res = await sendRequest<ITaskResponse>('POST', '/tasks', { title });

    if (res) {
      setTitle('');
      setTaskData(res);
      if (res.id) setTaskId(res.id);
    }
  };

  const handleReplay = async () => {
    if (!taskId.trim()) return;

    const res = await sendRequest<ITaskResponse>('GET', `/tasks/${taskId}`);

    if (res) setTaskData(res);
  };

  const handleComplete = async () => {
    if (!taskId.trim()) return;

    const res = await sendRequest<ITaskResponse>('PATCH', `/tasks/${taskId}/complete`);

    if (res) setTaskData(res);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-emerald-400">
        Управление задачами (CQRS + Event Sourcing + Outbox)
      </h1>

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

      <div className="flex gap-2 pt-4 border-t border-slate-800">
        <input
          type="text"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          placeholder="Task ID..."
          className="flex-1 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={handleReplay} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg text-sm">
          GET (Replay)
        </button>
        <button onClick={handleComplete} className="bg-amber-600 hover:bg-amber-500 px-3 py-2 rounded-lg text-sm">
          PATCH (Complete)
        </button>
      </div>

      {taskData && (
        <pre className="p-4 rounded-lg text-xs text-slate-600 border border-slate-800 overflow-x-auto">
          {JSON.stringify(taskData, null, 2)}
        </pre>
      )}
    </div>
  );
}


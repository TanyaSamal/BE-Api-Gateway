'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { apiRequest } from '@/lib/api';

export interface RequestLog {
  id: string;
  endpoint: string;
  method: string;
  correlationId: string;
  durationMs: number;
  errorMessage?: string;
  status: 'SUCCESS' | 'ERROR';
  timestamp: string;
}

interface TraceContextType {
  logs: RequestLog[];
  clearLogs: () => void;
  sendRequest: <T>(method: string, endpoint: string, body?: unknown) => Promise<T | null>;
}

const TraceContext = createContext<TraceContextType | null>(null);

export function TraceProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<RequestLog[]>([]);

  const sendRequest = async <T,>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T | null> => {
    try {
      const res = await apiRequest<T>(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });

      setLogs((prev) => [
        {
          id: crypto.randomUUID(),
          method,
          endpoint,
          correlationId: res.correlationId,
          durationMs: res.durationMs,
          status: 'SUCCESS',
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);

      return res.data;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setLogs((prev) => [
        {
          id: crypto.randomUUID(),
          method,
          endpoint,
          correlationId: 'ERROR',
          durationMs: 0,
          status: 'ERROR',
          errorMessage: msg,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      return null;
    }
  };

  return (
    <TraceContext.Provider value={{ logs, clearLogs: () => setLogs([]), sendRequest }}>
      {children}
    </TraceContext.Provider>
  );
}

export const useTrace = () => {
  const ctx = useContext(TraceContext);
  if (!ctx) throw new Error('useTrace must be used inside TraceProvider');
  return ctx;
};

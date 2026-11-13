const API_URL = 'http://localhost:3001';

export interface ApiResponse<T> {
  data: T;
  correlationId: string;
  durationMs: number;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const correlationId = crypto.randomUUID();
  const start = performance.now();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': correlationId,
      ...options.headers,
    },
  });

  const durationMs = Math.round(performance.now() - start);
  const serverCorrelationId = response.headers.get('x-correlation-id') || correlationId;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return { data, correlationId: serverCorrelationId, durationMs };
}

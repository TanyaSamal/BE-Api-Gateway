export interface ITaskResponse {
  id: string;
  title: string;
  status?: 'OPEN' | 'COMPLETED' | string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ITaskResponse {
  id: string | number;
  title: string;
  status?: 'OPEN' | 'COMPLETED' | string;
  createdAt?: string;
  [key: string]: unknown;
}

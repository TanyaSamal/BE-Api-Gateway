import { Task } from '../models/task.model';

export interface ITaskRepository {
  save(task: Task): Promise<void>;
  findAll(): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
}

import { Injectable } from '@nestjs/common';
import { ITaskRepository } from '../../domain/repositories/task.repository.interface';
import { Task } from '../../domain/models/task.model';

@Injectable()
export class InMemoryTaskRepository implements ITaskRepository {
  // Хранилище задач в памяти на время работы приложения
  private readonly tasks: Task[] = [];

  async save(task: Task): Promise<void> {
    const index = this.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      this.tasks[index] = task; // Обновляем
    } else {
      this.tasks.push(task); // Создаем новую
    }
    return Promise.resolve();
  }

  async findAll(): Promise<Task[]> {
    return Promise.resolve(this.tasks);
  }

  async findById(id: string): Promise<Task | null> {
    const task = this.tasks.find((t) => t.id === id);
    return Promise.resolve(task || null);
  }
}

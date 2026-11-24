import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  Action,
  CaslAbilityFactory,
  CurrentUser,
  TaskSubject,
} from './casl-ability.factory';
import { Task } from '../domain/models/task.model';
import { GetTaskQuery } from '../application/queries/get-task.query';

@Injectable()
export class DeleteTaskGuard implements CanActivate {
  constructor(
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly queryBus: QueryBus,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Берем пользователя из request.user или из заголовков (в едином стиле с вашим completeTask)
    const user: CurrentUser = request.user || {
      id: (request.headers['x-user-id'] as string) || 'user-1',
      role: (request.headers['x-user-role'] as 'user' | 'admin') || 'user',
    };

    const taskId = request.params.id;

    // 1. Загружаем задачу через QueryBus (Replay событий)
    const task = await this.queryBus.execute<GetTaskQuery, Task>(
      new GetTaskQuery(taskId),
    );

    if (!task || task.isDeleted) {
      throw new NotFoundException(`Задача ${taskId} не найдена`);
    }

    // 2. Создаем субъект с атрибутом authorId для CASL
    const taskSubject = new TaskSubject({
      id: task.id,
      authorId: task.authorId,
    });

    // 3. Проверяем права через CASL Ability
    const ability = this.caslAbilityFactory.createForUser(user);

    if (!ability.can(Action.Delete, taskSubject)) {
      throw new ForbiddenException(
        `Доступ запрещен: пользователь "${user.id}" (${user.role}) не является автором задачи (автор: "${task.authorId}")`,
      );
    }

    return true;
  }
}

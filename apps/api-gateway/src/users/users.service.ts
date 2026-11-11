import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  private readonly users = new Map<string, User>();

  constructor() {
    // Предзаполненный тестовый пользователь для быстрого старта
    this.users.set('user-1', {
      id: 'user-1',
      email: 'developer@nestjs-enterprise.local',
      isTwoFactorEnabled: false,
    });
  }

  async findById(id: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async setTwoFactorSecret(userId: string, secret: string): Promise<void> {
    const user = await this.findById(userId);
    user.twoFactorSecret = secret;
    this.users.set(userId, user);
  }

  async enableTwoFactor(userId: string): Promise<void> {
    const user = await this.findById(userId);
    user.isTwoFactorEnabled = true;
    this.users.set(userId, user);
  }

  async disableTwoFactor(userId: string): Promise<void> {
    const user = await this.findById(userId);
    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    this.users.set(userId, user);
  }
}

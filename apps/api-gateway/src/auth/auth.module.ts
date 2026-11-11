import {
  Module,
  Global,
  OnModuleInit,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CqrsModule, CommandBus, ICommand } from '@nestjs/cqrs';
import { UsersService } from '../users/users.service';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { REQUIRE_2FA_METADATA } from './require-2fa.decorator';
import { TwoFactorAuthController } from './auth.controller';
import { Reflector } from '@nestjs/core';
import { ITwoFactorCommand } from './two-factor-command.interface';

@Global()
@Module({
  imports: [CqrsModule],
  controllers: [TwoFactorAuthController],
  providers: [UsersService, TwoFactorAuthService],
  exports: [UsersService, TwoFactorAuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly twoFactorService: TwoFactorAuthService,
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    // Сохраняем оригинальный метод execute
    const originalExecute = this.commandBus.execute.bind(this.commandBus);

    // Переопределяем execute с проверкой 2FA
    this.commandBus.execute = async <T extends ICommand, R = any>(
      command: T,
    ): Promise<R> => {
      const is2FARequired = this.reflector.get<boolean>(
        REQUIRE_2FA_METADATA,
        command.constructor,
      );

      if (is2FARequired) {
        await this.validate2FA(command as unknown as ITwoFactorCommand);
      }

      return originalExecute(command);
    };
  }

  private async validate2FA(command: ITwoFactorCommand): Promise<void> {
    if (!command.userId) {
      throw new BadRequestException(
        'User ID is required for 2FA protected commands',
      );
    }

    const user = await this.usersService.findById(command.userId);

    // Если 2FA у пользователя выключен — выполняем команду как обычно
    if (!user.isTwoFactorEnabled) {
      return;
    }

    if (!command.twoFactorToken) {
      throw new ForbiddenException({
        message: '2FA token required in x-2fa-token header',
        code: '2FA_REQUIRED',
      });
    }

    const isValid = await this.twoFactorService.verifyCode(
      command.twoFactorToken,
      user.twoFactorSecret!,
    );

    if (!isValid) {
      throw new ForbiddenException({
        message: 'Invalid 2FA token',
        code: 'INVALID_2FA_TOKEN',
      });
    }
  }
}

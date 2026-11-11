import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth/2fa')
export class TwoFactorAuthController {
  constructor(
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('generate')
  // @UseGuards(JwtAuthGuard) // Предполагается, что пользователь уже авторизован по JWT
  async generate(@Req() req: any) {
    // Для примера берем userId из req.user или мокаем
    const userId = req.user?.id || 'user-1';
    const user = await this.usersService.findById(userId);

    const { secret, otpauthUrl } =
      this.twoFactorAuthService.generateTwoFactorSecret(user.email);

    // Сохраняем временный или основной секрет (пока без флага isTwoFactorEnabled = true)
    await this.usersService.setTwoFactorSecret(user.id, secret);

    return {
      otpauthUrl,
    };
  }

  @Post('turn-on')
  // @UseGuards(JwtAuthGuard)
  async turnOn(@Req() req: any, @Body('code') code: string) {
    const userId = req.user?.id || 'user-1';
    const user = await this.usersService.findById(userId);

    if (!user.twoFactorSecret) {
      throw new BadRequestException('2FA secret is not generated');
    }

    const isCodeValid = await this.twoFactorAuthService.verifyCode(
      code,
      user.twoFactorSecret,
    );

    if (!isCodeValid) {
      throw new UnauthorizedException('Invalid 2FA verification code');
    }

    await this.usersService.enableTwoFactor(user.id);
    return { message: '2FA successfully enabled' };
  }
}

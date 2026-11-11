import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';

@Injectable()
export class TwoFactorAuthService {
  private readonly appName = 'NestJS-Enterprise-App';

  /**
   * Генерирует Base32-секрет и URI для QR-кода
   */
  generateTwoFactorSecret(userEmail: string): {
    secret: string;
    otpauthUrl: string;
  } {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: this.appName,
      label: userEmail,
      secret,
    });

    return {
      secret,
      otpauthUrl,
    };
  }

  /**
   * Проверяет 6-значный код от пользователя
   */
  async verifyCode(token: string, secret: string): Promise<boolean> {
    if (!token || !secret) {
      return false;
    }

    const result = await verify({
      token,
      secret,
    });

    return result.valid;
  }
}

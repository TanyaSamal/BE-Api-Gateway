import { SetMetadata } from '@nestjs/common';
import { ITwoFactorCommand } from 'apps/api-gateway/src/auth/two-factor-command.interface';

export const REQUIRE_2FA_METADATA = 'REQUIRE_2FA_METADATA';
export const Require2FA = () => SetMetadata(REQUIRE_2FA_METADATA, true);

@Require2FA()
export class CompleteTaskCommand implements ITwoFactorCommand {
  constructor(
    public readonly taskId: string,
    public readonly userId: string,
    public readonly twoFactorToken?: string,
  ) {}
}

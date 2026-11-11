export interface ITwoFactorCommand {
  readonly userId: string;
  readonly twoFactorToken?: string;
}

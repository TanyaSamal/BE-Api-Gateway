export interface User {
  id: string;
  email: string;
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
}

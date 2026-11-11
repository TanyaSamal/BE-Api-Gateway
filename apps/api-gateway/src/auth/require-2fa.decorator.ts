import 'reflect-metadata';

export const REQUIRE_2FA_METADATA = 'REQUIRE_2FA_METADATA';

export function Require2FA(): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(REQUIRE_2FA_METADATA, true, target);
  };
}

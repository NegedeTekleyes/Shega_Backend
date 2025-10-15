import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { firstValueFrom, isObservable } from 'rxjs';

@Injectable()
export class EitherAuthGuard implements CanActivate {
  constructor(
    private readonly adminApiKeyGuard: AdminApiKeyGuard,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ✅ 1. Try admin API key guard first
    const adminResult = this.adminApiKeyGuard.canActivate(context);
    const adminOk = isObservable(adminResult)
      ? await firstValueFrom(adminResult)
      : await Promise.resolve(adminResult);

    if (adminOk) return true;

    // ✅ 2. Fall back to JWT guard
    const jwtResult = this.jwtAuthGuard.canActivate(context);
    const jwtOk = isObservable(jwtResult)
      ? await firstValueFrom(jwtResult)
      : await Promise.resolve(jwtResult);

    return jwtOk;
  }
}

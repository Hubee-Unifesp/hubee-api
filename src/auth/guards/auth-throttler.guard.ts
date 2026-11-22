import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  consumeRateLimit,
  type RateLimitStore,
} from '../../common/rate-limit/fixed-window-rate-limit';

export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;
export const AUTH_RATE_LIMIT_STORE = Symbol('AUTH_RATE_LIMIT_STORE');

export type AuthRateLimitStore = RateLimitStore;

export const createAuthRateLimitStoreProvider = () => ({
  provide: AUTH_RATE_LIMIT_STORE,
  useFactory: (): AuthRateLimitStore => new Map(),
});

interface RateLimitRequest {
  ip?: string;
  socket?: { remoteAddress?: string };
}

interface RateLimitResponse {
  setHeader?: (name: string, value: string | number) => void;
}

@Injectable()
export class AuthThrottlerGuard implements CanActivate {
  constructor(
    @Optional()
    @Inject(AUTH_RATE_LIMIT_STORE)
    private readonly store?: AuthRateLimitStore,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.store) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RateLimitRequest>();
    const res = http.getResponse<RateLimitResponse>();

    const key = `${context.getHandler().name}:${this.extractClientIp(req)}`;
    const { allowed, retryAfterSeconds } = consumeRateLimit(this.store, key, {
      limit: AUTH_THROTTLE_LIMIT,
      windowMs: AUTH_THROTTLE_TTL_MS,
    });

    if (!allowed) {
      res?.setHeader?.('Retry-After', retryAfterSeconds);
      throw new HttpException(
        'Muitas tentativas em sequência. Tente novamente em instantes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private extractClientIp(req: RateLimitRequest): string {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}

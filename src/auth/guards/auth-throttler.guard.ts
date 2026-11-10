import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';

export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;
export const AUTH_RATE_LIMIT_STORE = Symbol('AUTH_RATE_LIMIT_STORE');

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export type AuthRateLimitStore = Map<string, RateLimitEntry>;

export const createAuthRateLimitStoreProvider = () => ({
  provide: AUTH_RATE_LIMIT_STORE,
  useFactory: (): AuthRateLimitStore => new Map(),
});

interface RateLimitRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
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
    const now = Date.now();

    const handlerName = context.getHandler().name;
    const tracker = this.extractClientIp(req);
    const key = `${handlerName}:${tracker}`;

    const current = this.store.get(key);
    const entry =
      !current || now >= current.resetAt
        ? { count: 1, resetAt: now + AUTH_THROTTLE_TTL_MS }
        : { count: current.count + 1, resetAt: current.resetAt };

    this.store.set(key, entry);

    const remainingSeconds = Math.max(
      1,
      Math.ceil((entry.resetAt - now) / 1000),
    );

    if (entry.count > AUTH_THROTTLE_LIMIT) {
      res?.setHeader?.('Retry-After', remainingSeconds);
      throw new HttpException(
        'Muitas tentativas em sequência. Tente novamente em instantes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private extractClientIp(req: RateLimitRequest): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0 && forwarded[0]) {
      return forwarded[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}

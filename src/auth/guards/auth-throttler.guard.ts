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

    this.pruneExpiredEntries(now);

    const handlerName = context.getHandler().name;
    const tracker = this.extractClientIp(req);
    const key = `${handlerName}:${tracker}`;

    const current = this.store.get(key);
    const isNewWindow = !current || now >= current.resetAt;
    const entry = isNewWindow
      ? { count: 1, resetAt: now + AUTH_THROTTLE_TTL_MS }
      : { count: current.count + 1, resetAt: current.resetAt };

    this.store.set(key, entry);

    if (isNewWindow) {
      this.scheduleEntryCleanup(key, entry.resetAt);
    }

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

  private pruneExpiredEntries(now: number): void {
    if (!this.store) {
      return;
    }
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  private scheduleEntryCleanup(key: string, resetAt: number): void {
    const timer = setTimeout(() => {
      const current = this.store?.get(key);
      if (current && current.resetAt === resetAt) {
        this.store?.delete(key);
      }
    }, AUTH_THROTTLE_TTL_MS);
    timer.unref?.();
  }

  private extractClientIp(req: RateLimitRequest): string {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}

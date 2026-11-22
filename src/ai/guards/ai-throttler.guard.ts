import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../auth/decorators/current-user.decorator';
import {
  consumeRateLimit,
  type RateLimitStore,
} from '../../common/rate-limit/fixed-window-rate-limit';
import type { EnvironmentVariables } from '../../config/env.validation';

export const AI_RATE_LIMIT_STORE = Symbol('AI_RATE_LIMIT_STORE');

export const createAiRateLimitStoreProvider = () => ({
  provide: AI_RATE_LIMIT_STORE,
  useFactory: (): RateLimitStore => new Map(),
});

interface AiRateLimitRequest {
  user?: AuthenticatedUser;
  ip?: string;
  socket?: { remoteAddress?: string };
}

interface AiRateLimitResponse {
  setHeader?: (name: string, value: string | number) => void;
}

@Injectable()
export class AiThrottlerGuard implements CanActivate {
  constructor(
    @Inject(AI_RATE_LIMIT_STORE) private readonly store: RateLimitStore,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<AiRateLimitRequest>();
    const res = http.getResponse<AiRateLimitResponse>();

    const { allowed, retryAfterSeconds } = consumeRateLimit(
      this.store,
      this.trackerFor(req),
      {
        limit: this.config.get('AI_RATE_LIMIT_MAX', { infer: true }),
        windowMs: this.config.get('AI_RATE_LIMIT_WINDOW_MS', { infer: true }),
      },
    );

    if (!allowed) {
      res?.setHeader?.('Retry-After', retryAfterSeconds);
      throw new HttpException(
        `Você atingiu o limite de gerações com IA. Tente novamente em ${retryAfterSeconds} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private trackerFor(req: AiRateLimitRequest): string {
    if (req.user?.id) {
      return `ai:user:${req.user.id}`;
    }
    return `ai:ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  }
}

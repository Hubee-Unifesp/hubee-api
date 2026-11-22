import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { RateLimitStore } from '../../common/rate-limit/fixed-window-rate-limit';
import type { EnvironmentVariables } from '../../config/env.validation';
import { AiRateLimited } from '../decorators/ai-rate-limited.decorator';
import { AiThrottlerGuard } from './ai-throttler.guard';

const ENV: Partial<EnvironmentVariables> = {
  AI_RATE_LIMIT_MAX: 2,
  AI_RATE_LIMIT_WINDOW_MS: 60_000,
};

let store: RateLimitStore;

function makeGuard(env: Partial<EnvironmentVariables> = ENV) {
  return new AiThrottlerGuard(store, {
    get: (key: keyof EnvironmentVariables) => env[key],
  } as unknown as ConfigService<EnvironmentVariables, true>);
}

function makeContext(
  request: { user?: { id: string }; ip?: string },
  setHeader = jest.fn(),
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
}

const userA = () => makeContext({ user: { id: 'user-a' }, ip: '192.0.2.1' });

describe('AiThrottlerGuard', () => {
  beforeEach(() => {
    store = new Map();
  });

  it('libera até AI_RATE_LIMIT_MAX chamadas por usuário', () => {
    const guard = makeGuard();

    expect(guard.canActivate(userA())).toBe(true);
    expect(guard.canActivate(userA())).toBe(true);
  });

  it('responde 429 em pt-BR com Retry-After quando o limite estoura', () => {
    const guard = makeGuard();
    const setHeader = jest.fn();
    guard.canActivate(userA());
    guard.canActivate(userA());

    let caught: unknown;
    try {
      guard.canActivate(
        makeContext({ user: { id: 'user-a' }, ip: '192.0.2.1' }, setHeader),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect((caught as HttpException).message).toBe(
      'Você atingiu o limite de gerações com IA. Tente novamente em 60 segundos.',
    );
    expect(setHeader).toHaveBeenCalledWith('Retry-After', 60);
  });

  it('conta por usuário, não por IP', () => {
    const guard = makeGuard();
    guard.canActivate(userA());
    guard.canActivate(userA());

    const userBSameIp = makeContext({
      user: { id: 'user-b' },
      ip: '192.0.2.1',
    });
    const userAOtherIp = makeContext({
      user: { id: 'user-a' },
      ip: '198.51.100.7',
    });

    expect(guard.canActivate(userBSameIp)).toBe(true);
    expect(() => guard.canActivate(userAOtherIp)).toThrow(HttpException);
  });

  it('usa o IP quando a requisição não tem usuário', () => {
    const guard = makeGuard();
    const anonymous = () => makeContext({ ip: '203.0.113.9' });
    guard.canActivate(anonymous());
    guard.canActivate(anonymous());

    expect(() => guard.canActivate(anonymous())).toThrow(HttpException);
    expect(store.has('ai:ip:203.0.113.9')).toBe(true);
  });

  it('lê o limite e a janela das variáveis de ambiente', () => {
    const guard = makeGuard({
      AI_RATE_LIMIT_MAX: 1,
      AI_RATE_LIMIT_WINDOW_MS: 10_000,
    });
    const setHeader = jest.fn();
    guard.canActivate(userA());

    expect(() =>
      guard.canActivate(makeContext({ user: { id: 'user-a' } }, setHeader)),
    ).toThrow(HttpException);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', 10);
  });
});

describe('@AiRateLimited()', () => {
  it('autentica antes de aplicar o limite de IA', () => {
    class Controller {
      @AiRateLimited()
      generate() {
        return undefined;
      }
    }

    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      Controller.prototype.generate,
    ) as unknown[];

    expect(guards).toEqual([JwtAuthGuard, AiThrottlerGuard]);
  });
});

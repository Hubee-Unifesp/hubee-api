import { describe, expect, it, jest } from '@jest/globals';
import {
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  AuthThrottlerGuard,
  type AuthRateLimitStore,
} from './auth-throttler.guard';

function makeContext(
  handlerName: 'login' | 'register',
  ip = '127.0.0.1',
  forwardedFor?: string,
  setHeader = jest.fn(),
): ExecutionContext {
  const handler = { [handlerName]: () => undefined }[handlerName];
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthThrottlerGuard', () => {
  it('libera quando o store não está configurado', () => {
    const guard = new AuthThrottlerGuard(undefined);
    expect(guard.canActivate(makeContext('login'))).toBe(true);
  });

  it('permite até AUTH_THROTTLE_LIMIT requisições e bloqueia a seguinte com 429 e Retry-After', () => {
    const store: AuthRateLimitStore = new Map();
    const guard = new AuthThrottlerGuard(store);
    const setHeader = jest.fn();
    const ctx = makeContext(
      'login',
      '127.0.0.1',
      '203.0.113.5, 10.0.0.1',
      setHeader,
    );

    for (let i = 0; i < AUTH_THROTTLE_LIMIT; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }

    expect(() => guard.canActivate(ctx)).toThrow(
      new HttpException(
        'Muitas tentativas em sequência. Tente novamente em instantes.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('ignora cabeçalho X-Forwarded-For manual e contabiliza apenas por req.ip', () => {
    const store: AuthRateLimitStore = new Map();
    const guard = new AuthThrottlerGuard(store);

    for (let i = 0; i < AUTH_THROTTLE_LIMIT; i++) {
      const ctx = makeContext('login', '127.0.0.1', `203.0.113.${i + 1}`);
      expect(guard.canActivate(ctx)).toBe(true);
    }

    const spoofedCtx = makeContext('login', '127.0.0.1', '198.51.100.250');
    expect(() => guard.canActivate(spoofedCtx)).toThrow(HttpException);
  });

  it('isola contadores por rota (login vs register) e por IP, remove chaves vencidas e reinicia após expirar o TTL', () => {
    const store: AuthRateLimitStore = new Map();
    const guard = new AuthThrottlerGuard(store);
    const loginCtxIpA = makeContext('login', '192.0.2.1');
    const registerCtxIpA = makeContext('register', '192.0.2.1');
    const loginCtxIpB = makeContext('login', '192.0.2.2');

    for (let i = 0; i < AUTH_THROTTLE_LIMIT; i++) {
      expect(guard.canActivate(loginCtxIpA)).toBe(true);
    }
    expect(() => guard.canActivate(loginCtxIpA)).toThrow(HttpException);

    // Outra rota no mesmo IP e mesma rota em outro IP continuam liberadas:
    expect(guard.canActivate(registerCtxIpA)).toBe(true);
    expect(guard.canActivate(loginCtxIpB)).toBe(true);
    expect(store.size).toBe(3);

    // Após expirar a janela (TTL), chaves antigas são removidas do Map e o IP bloqueado volta a passar:
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + AUTH_THROTTLE_TTL_MS + 1);
    expect(guard.canActivate(loginCtxIpA)).toBe(true);
    expect(store.has('register:192.0.2.1')).toBe(false);
    expect(store.has('login:192.0.2.2')).toBe(false);
    expect(store.size).toBe(1);
    nowSpy.mockRestore();
  });

  it('remove automaticamente a entrada do Map quando o timer do TTL expira', () => {
    jest.useFakeTimers();
    try {
      const store: AuthRateLimitStore = new Map();
      const guard = new AuthThrottlerGuard(store);
      const ctx = makeContext('login', '192.0.2.99');

      expect(guard.canActivate(ctx)).toBe(true);
      expect(store.has('login:192.0.2.99')).toBe(true);

      jest.advanceTimersByTime(AUTH_THROTTLE_TTL_MS);
      expect(store.has('login:192.0.2.99')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

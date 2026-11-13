import { describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { DatabaseHealth, HealthService } from './health.service';

function controllerWith(database: DatabaseHealth) {
  const checkDatabase = jest.fn(async () => database);
  const controller = new HealthController({
    checkDatabase,
  } as unknown as HealthService);
  return { controller, checkDatabase };
}

describe('HealthController', () => {
  it('GET /health/ping responde ok sem consultar o banco', () => {
    const { controller, checkDatabase } = controllerWith({
      status: 'down',
      latencyMs: 0,
    });

    expect(controller.ping()).toEqual({ status: 'ok' });
    expect(checkDatabase).not.toHaveBeenCalled();
  });

  it('GET /health devolve o estado do banco', async () => {
    const { controller } = controllerWith({ status: 'up', latencyMs: 3 });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: { status: 'up', latencyMs: 3 },
    });
  });

  it('GET /health dá 503 com o banco fora do ar', async () => {
    const { controller } = controllerWith({ status: 'down', latencyMs: 5 });

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

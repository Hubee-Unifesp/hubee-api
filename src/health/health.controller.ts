import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import type { DatabaseHealth } from './health.service';

interface HealthResponse {
  status: 'ok' | 'error';
  database: DatabaseHealth;
}

interface PingResponse {
  status: 'ok';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const database = await this.healthService.checkDatabase();

    if (database.status === 'down') {
      throw new ServiceUnavailableException({
        status: 'error',
        database,
      } satisfies HealthResponse);
    }

    return { status: 'ok', database };
  }

  @Get('ping')
  @ApiOkResponse({ description: 'API no ar, sem consultar o banco' })
  ping(): PingResponse {
    return { status: 'ok' };
  }
}

import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiThrottlerGuard } from '../guards/ai-throttler.guard';

export function AiRateLimited() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, AiThrottlerGuard),
    ApiTooManyRequestsResponse({
      description:
        'Limite de gerações com IA atingido. O cabeçalho Retry-After indica quantos segundos esperar.',
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    }),
  );
}

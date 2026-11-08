import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OrganizerGuard } from '../guards/organizer.guard';

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

/**
 * Restringe a rota (ou o controller inteiro) a organizadores autenticados
 * (usuários com vínculo `accepted` em pelo menos uma organização) ou `ADMIN`
 * global, e documenta o Bearer e as respostas 401/403 no Swagger.
 */
export function OrganizerOnly() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, OrganizerGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido ou expirado.',
      schema: errorSchema,
    }),
    ApiForbiddenResponse({
      description: 'Acesso restrito a organizadores de eventos.',
      schema: errorSchema,
    }),
  );
}

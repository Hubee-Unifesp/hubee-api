import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

/**
 * Restringe a rota (ou o controller inteiro) a usuários ADMIN autenticados e
 * documenta o Bearer e as respostas 401/403 no Swagger.
 *
 * Regra provisória: até o spike GOL-109 definir as permissões por
 * organização, toda escrita fora de users/orders/tickets é só ADMIN.
 */
export function AdminOnly() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles('ADMIN'),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido ou expirado.',
      schema: errorSchema,
    }),
    ApiForbiddenResponse({
      description: 'Usuário sem permissão (requer ADMIN).',
      schema: errorSchema,
    }),
  );
}

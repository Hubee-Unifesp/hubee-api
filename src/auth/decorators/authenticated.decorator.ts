import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

/**
 * Exige qualquer usuário autenticado (USER ou ADMIN) e documenta o Bearer e o
 * 401 no Swagger. Não checa dono: o service filtra pelo `@CurrentUser()` e
 * responde 404 para recurso de outra pessoa.
 */
export function Authenticated() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido ou expirado.',
      schema: errorSchema,
    }),
  );
}

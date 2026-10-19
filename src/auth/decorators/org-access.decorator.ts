import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OrganizationAccessGuard } from '../guards/organization-access.guard';
import {
  ORG_ACCESS_KEY,
  type OrgAccessLevel,
  type OrgAccessMetadata,
  type OrgAccessSource,
} from '../org-access-level';

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

/**
 * Exige que o usuário autenticado tenha ao menos `level` na organização do
 * recurso (vínculo em `organization_users` com convite aceito). O ADMIN global
 * passa sempre. Sem `options`, a organização vem do param `orgId` da rota.
 *
 * @example
 * @OrgAccess('manage')
 * @OrgAccess('read', { from: 'event', param: 'eventId' })
 * @OrgAccess('write', { from: 'body', field: 'organizerId' })
 */
export function OrgAccess(
  level: OrgAccessLevel,
  source: OrgAccessSource = { from: 'org' },
) {
  const metadata: OrgAccessMetadata = { level, source };
  return applyDecorators(
    SetMetadata(ORG_ACCESS_KEY, metadata),
    UseGuards(JwtAuthGuard, OrganizationAccessGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido ou expirado.',
      schema: errorSchema,
    }),
    ApiForbiddenResponse({
      description: `Usuário sem o nível de acesso "${level}" na organização.`,
      schema: errorSchema,
    }),
  );
}

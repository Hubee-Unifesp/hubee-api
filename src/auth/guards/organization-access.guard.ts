import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { DRIZZLE } from '../../database/database.constants';
import type { DrizzleDatabase } from '../../database/database.provider';
import { events, organizationUsers } from '../../database/schema';
import { InviteStatus } from '../../organization-users/dto/create-organization-user.dto';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import {
  effectiveLevel,
  ORG_ACCESS_KEY,
  satisfiesLevel,
  type OrgAccessMetadata,
  type OrgAccessSource,
} from '../org-access-level';

/**
 * Confere o nível do usuário na organização do recurso (`@OrgAccess`). Roda
 * depois do `JwtAuthGuard`. O vínculo é lido do banco a cada requisição, não do
 * JWT, para que convite aceito ou permissão alterada valham na hora.
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<OrgAccessMetadata>(
      ORG_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!access) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new UnauthorizedException('Token ausente ou inválido');
    if (user.role === 'ADMIN') return true;

    const organizationId = await this.resolveOrganizationId(
      access.source,
      request,
    );

    const [membership] = await this.db
      .select({
        role: organizationUsers.role,
        permission: organizationUsers.permission,
        inviteStatus: organizationUsers.inviteStatus,
      })
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.orgId, organizationId),
          eq(organizationUsers.userId, user.id),
          eq(organizationUsers.inviteStatus, InviteStatus.ACCEPTED),
        ),
      );

    if (
      !membership ||
      !satisfiesLevel(effectiveLevel(membership), access.level)
    )
      throw new ForbiddenException('Acesso negado');
    return true;
  }

  private async resolveOrganizationId(
    source: OrgAccessSource,
    request: { params?: Record<string, unknown>; body?: unknown },
  ): Promise<string> {
    if (source.from === 'body') {
      const field = source.field ?? 'organizerId';
      const body = (request.body ?? {}) as Record<string, unknown>;
      return this.requireUuid(body[field], field);
    }

    if (source.from === 'event') {
      const param = source.param ?? 'eventId';
      const eventId = this.requireUuid(request.params?.[param], param);
      const [event] = await this.db
        .select({ organizerId: events.organizerId })
        .from(events)
        .where(eq(events.id, eventId));
      if (!event)
        throw new NotFoundException(`Evento ${eventId} não encontrado`);
      return event.organizerId;
    }

    const param = source.param ?? 'orgId';
    return this.requireUuid(request.params?.[param], param);
  }

  /** O guard roda antes dos pipes, então valida o UUID para não estourar no Postgres. */
  private requireUuid(value: unknown, name: string): string {
    if (typeof value !== 'string' || !isUUID(value))
      throw new BadRequestException(`${name} deve ser um UUID válido`);
    return value;
  }
}

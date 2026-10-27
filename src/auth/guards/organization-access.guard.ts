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
import { eq } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { DRIZZLE } from '../../database/database.constants';
import type { DrizzleDatabase } from '../../database/database.provider';
import { events } from '../../database/schema';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import {
  effectiveLevel,
  ORG_ACCESS_KEY,
  satisfiesLevel,
  type OrgAccessMetadata,
  type OrgAccessSource,
} from '../org-access-level';
import { findAcceptedMembership } from '../organization-membership';

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

    const membership = await findAcceptedMembership(
      this.db,
      user.id,
      organizationId,
    );

    // Evento de outra organização responde o mesmo 404 de evento inexistente,
    // para não revelar que ele existe (CONVENTIONS.md). Membro sem o nível
    // exigido já vê o evento, então recebe 403.
    if (!membership && access.source.from === 'event') {
      const eventId = request.params[access.source.param ?? 'eventId'];
      throw new NotFoundException(`Evento ${eventId} não encontrado`);
    }
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

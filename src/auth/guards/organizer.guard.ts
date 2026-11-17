import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DRIZZLE } from '../../database/database.constants';
import type { DrizzleDatabase } from '../../database/database.provider';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { findUserOrganizations } from '../organization-membership';

/**
 * Exige que o usuário autenticado seja `ADMIN` global ou membro ativo
 * (convite `accepted`) de pelo menos uma organização. Roda depois do
 * `JwtAuthGuard`.
 */
@Injectable()
export class OrganizerGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new UnauthorizedException('Token ausente ou inválido');
    }

    if (user.role === 'ADMIN') {
      return true;
    }

    const organizations = await findUserOrganizations(this.db, user.id);
    if (organizations.length === 0) {
      throw new ForbiddenException(
        'Acesso restrito a organizadores de eventos',
      );
    }

    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/i.exec(authorization)
        : null;
    if (!match) throw new UnauthorizedException('Token ausente ou inválido');
    let payload: { sub?: unknown; email?: unknown; role?: unknown };
    try {
      payload = await this.jwtService.verifyAsync(match[1]);
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof payload.email !== 'string' ||
        !['USER', 'ADMIN'].includes(payload.role as string)
      ) {
        throw new Error('Invalid claims');
      }
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    if (typeof this.usersService?.findActiveUser === 'function') {
      const user = await this.usersService.findActiveUser(payload.sub);
      if (!user || !['USER', 'ADMIN'].includes(user.role)) {
        throw new UnauthorizedException('Usuário inativo ou não encontrado');
      }
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      return true;
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return true;
  }
}

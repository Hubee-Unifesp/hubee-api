import { ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../../users/users.service';

/**
 * Para rotas públicas que mostram mais para quem está logado: sem
 * `Authorization` a requisição segue anônima (`request.user` fica vazio).
 * Um token enviado mas inválido ainda dá 401, para o cliente não receber em
 * silêncio a visão pública achando que está autenticado.
  */
  @Injectable()
  export class OptionalJwtAuthGuard extends JwtAuthGuard {
    constructor(
      jwtService: JwtService,
      @Optional() usersService?: UsersService,
    ) {
      super(jwtService, usersService);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      if (request.headers.authorization === undefined) return true;
      return super.canActivate(context);
  }
}

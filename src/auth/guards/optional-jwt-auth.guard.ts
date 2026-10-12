import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Para rotas públicas que mostram mais para quem está logado: sem
 * `Authorization` a requisição segue anônima (`request.user` fica vazio).
 * Um token enviado mas inválido ainda dá 401, para o cliente não receber em
 * silêncio a visão pública achando que está autenticado.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.headers.authorization === undefined) return true;
    return super.canActivate(context);
  }
}

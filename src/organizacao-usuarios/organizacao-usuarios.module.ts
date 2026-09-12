import { Module } from '@nestjs/common';
import { OrganizacaoUsuariosController } from './organizacao-usuarios.controller';
import { OrganizacaoUsuariosService } from './organizacao-usuarios.service';

@Module({
  controllers: [OrganizacaoUsuariosController],
  providers: [OrganizacaoUsuariosService],
})
export class OrganizacaoUsuariosModule {}

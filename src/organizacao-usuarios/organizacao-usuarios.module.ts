import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { OrganizacaoUsuariosController } from './organizacao-usuarios.controller';
import { OrganizacaoUsuariosService } from './organizacao-usuarios.service';

@Module({
  imports: [OrganizationModule, UsuariosModule],
  controllers: [OrganizacaoUsuariosController],
  providers: [OrganizacaoUsuariosService],
})
export class OrganizacaoUsuariosModule {}
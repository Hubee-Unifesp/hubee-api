import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
  // Exportado para que outros módulos possam validar a existência de um
  // usuário (ex: o representante de uma organização, GOL-34).
  exports: [UsuariosService],
})
export class UsuariosModule {}

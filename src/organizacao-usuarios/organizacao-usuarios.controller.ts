import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrganizacaoUsuariosService } from './organizacao-usuarios.service';
import { CreateOrganizacaoUsuarioDto } from './dto/create-organizacao-usuario.dto';
import { UpdateOrganizacaoUsuarioDto } from './dto/update-organizacao-usuario.dto';

@Controller('organizacoes/:orgId/usuarios')
export class OrganizacaoUsuariosController {
  constructor(
    private readonly organizacaoUsuariosService: OrganizacaoUsuariosService,
  ) {}

  @Post()
  create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateOrganizacaoUsuarioDto,
  ) {
    return this.organizacaoUsuariosService.create(orgId, dto);
  }

  @Get()
  findAll(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.organizacaoUsuariosService.findAll(orgId);
  }

  @Patch(':userId')
  update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateOrganizacaoUsuarioDto,
  ) {
    return this.organizacaoUsuariosService.update(orgId, userId, dto);
  }

  @Delete(':userId')
  remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.organizacaoUsuariosService.remove(orgId, userId);
  }
}
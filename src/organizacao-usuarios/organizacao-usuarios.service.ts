import { Injectable } from '@nestjs/common';
import { CreateOrganizacaoUsuarioDto } from './dto/create-organizacao-usuario.dto';
import { UpdateOrganizacaoUsuarioDto } from './dto/update-organizacao-usuario.dto';

@Injectable()
export class OrganizacaoUsuariosService {
  // TODO(GOL-35): substituir os mocks abaixo por acesso real via Drizzle
  // assim que as tabelas "organizacoes" (GOL-34) e "org_usuario" existirem.

  create(orgId: string, dto: CreateOrganizacaoUsuarioDto) {
    // TODO: inserir na tabela org_usuario com statusConvite = 'pendente'
    // TODO: validar se o vinculo ja existe (orgId + userId) antes de inserir
    return {
      orgId,
      userId: dto.userId,
      papel: dto.papel,
      permissao: dto.permissao,
      statusConvite: 'pendente',
    };
  }

  findAll(orgId: string) {
    // TODO: query real com join na tabela usuarios
    return [];
  }

  update(orgId: string, userId: string, dto: UpdateOrganizacaoUsuarioDto) {
    // TODO: buscar vinculo existente; lancar NotFoundException se nao existir
    // TODO: aplicar apenas os campos enviados no dto
    return { orgId, userId, ...dto };
  }

  remove(orgId: string, userId: string) {
    // TODO: deletar vinculo; lancar NotFoundException se nao existir
    return { message: 'Vinculo removido (mock)' };
  }
}
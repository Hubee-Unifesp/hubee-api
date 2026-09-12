import { IsUUID, IsEnum } from 'class-validator';

export enum PapelOrganizacao {
  ADMIN = 'admin',
  MEMBRO = 'membro',
}

export enum PermissaoOrganizacao {
  TOTAL = 'total',
  EDICAO = 'edicao',
  LEITURA = 'leitura',
}

export class CreateOrganizacaoUsuarioDto {
  @IsUUID()
  userId: string;

  @IsEnum(PapelOrganizacao)
  papel: PapelOrganizacao;

  @IsEnum(PermissaoOrganizacao)
  permissao: PermissaoOrganizacao;
}

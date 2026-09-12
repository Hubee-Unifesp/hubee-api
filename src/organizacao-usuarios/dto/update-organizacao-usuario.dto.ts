import { IsEnum, IsOptional } from 'class-validator';
import {
  PapelOrganizacao,
  PermissaoOrganizacao,
} from './create-organizacao-usuario.dto';

export enum StatusConvite {
  PENDENTE = 'pendente',
  ACEITO = 'aceito',
  RECUSADO = 'recusado',
}

export class UpdateOrganizacaoUsuarioDto {
  @IsOptional()
  @IsEnum(PapelOrganizacao)
  papel?: PapelOrganizacao;

  @IsOptional()
  @IsEnum(PermissaoOrganizacao)
  permissao?: PermissaoOrganizacao;

  @IsOptional()
  @IsEnum(StatusConvite)
  statusConvite?: StatusConvite;
}

import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { organizacaoUsuarios } from '../database/schema';
import { CreateOrganizacaoUsuarioDto } from './dto/create-organizacao-usuario.dto';
import { UpdateOrganizacaoUsuarioDto } from './dto/update-organizacao-usuario.dto';
import { DRIZZLE } from '../database/database.constants';

@Injectable()
export class OrganizacaoUsuariosService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  private async findVinculo(orgId: string, userId: string) {
    const [vinculo] = await this.db
      .select()
      .from(organizacaoUsuarios)
      .where(
        and(
          eq(organizacaoUsuarios.orgId, orgId),
          eq(organizacaoUsuarios.userId, userId),
        ),
      );
    return vinculo;
  }

  async create(orgId: string, dto: CreateOrganizacaoUsuarioDto) {
    const existente = await this.findVinculo(orgId, dto.userId);
    if (existente) {
      throw new ConflictException(
        'Este usuário já está vinculado a esta organização.',
      );
    }

    const [novoVinculo] = await this.db
      .insert(organizacaoUsuarios)
      .values({
        orgId,
        userId: dto.userId,
        papel: dto.papel,
        permissao: dto.permissao,
      })
      .returning();

    return novoVinculo;
  }

  async findAll(orgId: string) {
    return this.db
      .select()
      .from(organizacaoUsuarios)
      .where(eq(organizacaoUsuarios.orgId, orgId));
  }

  async update(
    orgId: string,
    userId: string,
    dto: UpdateOrganizacaoUsuarioDto,
  ) {
    const existente = await this.findVinculo(orgId, userId);
    if (!existente) {
      throw new NotFoundException(
        'Vínculo entre este usuário e esta organização não encontrado.',
      );
    }

    const [vinculoAtualizado] = await this.db
      .update(organizacaoUsuarios)
      .set({ ...dto, dataModificacao: new Date() })
      .where(
        and(
          eq(organizacaoUsuarios.orgId, orgId),
          eq(organizacaoUsuarios.userId, userId),
        ),
      )
      .returning();

    return vinculoAtualizado;
  }

  async remove(orgId: string, userId: string) {
    const existente = await this.findVinculo(orgId, userId);
    if (!existente) {
      throw new NotFoundException(
        'Vínculo entre este usuário e esta organização não encontrado.',
      );
    }

    await this.db
      .delete(organizacaoUsuarios)
      .where(
        and(
          eq(organizacaoUsuarios.orgId, orgId),
          eq(organizacaoUsuarios.userId, userId),
        ),
      );

    return { message: 'Vínculo removido com sucesso.' };
  }
}

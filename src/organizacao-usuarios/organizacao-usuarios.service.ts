import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { organizationUsers } from '../database/schema';
import { OrganizationService } from '../organization/organization.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateOrganizacaoUsuarioDto } from './dto/create-organizacao-usuario.dto';
import { UpdateOrganizacaoUsuarioDto } from './dto/update-organizacao-usuario.dto';
import { DRIZZLE } from '../database/database.constants';

@Injectable()
export class OrganizacaoUsuariosService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly organizationService: OrganizationService,
    private readonly usuariosService: UsuariosService,
  ) {}

  private vinculoWhere(orgId: string, userId: string) {
    return and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId),
    );
  }

  private async findVinculo(orgId: string, userId: string) {
    const [vinculo] = await this.db
      .select()
      .from(organizationUsers)
      .where(this.vinculoWhere(orgId, userId));
    return vinculo;
  }

  async create(orgId: string, dto: CreateOrganizacaoUsuarioDto) {
    await this.organizationService.findOne(orgId);
    await this.usuariosService.findOne(dto.userId);

    const existente = await this.findVinculo(orgId, dto.userId);
    if (existente) {
      throw new ConflictException(
        'Este usuário já está vinculado a esta organização.',
      );
    }

    const [newOrganizationUser] = await this.db
      .insert(organizationUsers)
      .values({
        orgId,
        userId: dto.userId,
        role: dto.role,
        permission: dto.permission,
        // undefined faz o Drizzle omitir a coluna e o default 'pending' valer
        inviteStatus: dto.inviteStatus,
      })
      .returning();

    return newOrganizationUser;
  }

  async findAll(orgId: string) {
    await this.organizationService.findOne(orgId);

    return this.db
      .select()
      .from(organizationUsers)
      .where(eq(organizationUsers.orgId, orgId));
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

    const { role, permission, inviteStatus } = dto;
    if (
      role === undefined &&
      permission === undefined &&
      inviteStatus === undefined
    ) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar: role, permission ou inviteStatus.',
      );
    }

    const [vinculoAtualizado] = await this.db
      .update(organizationUsers)
      // Campos undefined são ignorados pelo Drizzle, então um PATCH parcial
      // não sobrescreve o que não foi enviado.
      // updatedAt não entra aqui: o schema já tem $onUpdate.
      .set({ role, permission, inviteStatus })
      .where(this.vinculoWhere(orgId, userId))
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
      .delete(organizationUsers)
      .where(this.vinculoWhere(orgId, userId));

    return { message: 'Vínculo removido com sucesso.' };
  }
}
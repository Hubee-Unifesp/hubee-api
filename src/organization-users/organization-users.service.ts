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
import { UsersService } from '../users/users.service';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';
import { DRIZZLE } from '../database/database.constants';

@Injectable()
export class OrganizationUsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly organizationService: OrganizationService,
    private readonly usersService: UsersService,
  ) {}

  private membershipWhere(orgId: string, userId: string) {
    return and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId),
    );
  }

  private async findMembership(orgId: string, userId: string) {
    const [membership] = await this.db
      .select()
      .from(organizationUsers)
      .where(this.membershipWhere(orgId, userId));
    return membership;
  }

  async create(orgId: string, dto: CreateOrganizationUserDto) {
    await this.organizationService.findOne(orgId);
    await this.usersService.findOne(dto.userId);

    const existing = await this.findMembership(orgId, dto.userId);
    if (existing) {
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
    dto: UpdateOrganizationUserDto,
  ) {
    const existing = await this.findMembership(orgId, userId);
    if (!existing) {
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

    const [updatedMembership] = await this.db
      .update(organizationUsers)
      // Campos undefined são ignorados pelo Drizzle, então um PATCH parcial
      // não sobrescreve o que não foi enviado.
      // updatedAt não entra aqui: o schema já tem $onUpdate.
      .set({ role, permission, inviteStatus })
      .where(this.membershipWhere(orgId, userId))
      .returning();

    return updatedMembership;
  }

  async remove(orgId: string, userId: string): Promise<void> {
    const existing = await this.findMembership(orgId, userId);
    if (!existing) {
      throw new NotFoundException(
        'Vínculo entre este usuário e esta organização não encontrado.',
      );
    }

    await this.db
      .delete(organizationUsers)
      .where(this.membershipWhere(orgId, userId));
  }
}

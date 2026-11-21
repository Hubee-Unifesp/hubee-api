import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { organizations, organizationUsers, users } from '../database/schema';
import { OrganizationService } from '../organization/organization.service';
import { UsersService } from '../users/users.service';
import {
  CreateOrganizationUserDto,
  InviteStatus,
} from './dto/create-organization-user.dto';
import { RespondOrganizationInviteDto } from './dto/respond-organization-invite.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';
import { DRIZZLE } from '../database/database.constants';

const memberColumns = {
  orgId: organizationUsers.orgId,
  userId: organizationUsers.userId,
  userName: users.fullName,
  userEmail: users.email,
  role: organizationUsers.role,
  permission: organizationUsers.permission,
  inviteStatus: organizationUsers.inviteStatus,
  createdAt: organizationUsers.createdAt,
  updatedAt: organizationUsers.updatedAt,
};

const inviteColumns = {
  orgId: organizationUsers.orgId,
  organizationName: organizations.name,
  userId: organizationUsers.userId,
  role: organizationUsers.role,
  permission: organizationUsers.permission,
  inviteStatus: organizationUsers.inviteStatus,
  createdAt: organizationUsers.createdAt,
  updatedAt: organizationUsers.updatedAt,
};

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

  private async findMemberWithUser(orgId: string, userId: string) {
    const [member] = await this.db
      .select(memberColumns)
      .from(organizationUsers)
      .innerJoin(users, eq(users.id, organizationUsers.userId))
      .where(this.membershipWhere(orgId, userId));
    return member;
  }

  async create(orgId: string, dto: CreateOrganizationUserDto) {
    await this.organizationService.findOne(orgId);
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || (user.status && user.status !== 'ACTIVE')) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const existing = await this.findMembership(orgId, user.id);
    if (existing) {
      throw new ConflictException(
        'Este usuário já está vinculado a esta organização.',
      );
    }

    const [newOrganizationUser] = await this.db
      .insert(organizationUsers)
      .values({
        orgId,
        userId: user.id,
        role: dto.role,
        permission: dto.permission,
        inviteStatus: InviteStatus.PENDING,
      })
      .returning();

    return {
      ...newOrganizationUser,
      userName: user.fullName,
      userEmail: user.email,
    };
  }

  async findAll(orgId: string) {
    await this.organizationService.findOne(orgId);

    return this.db
      .select(memberColumns)
      .from(organizationUsers)
      .innerJoin(users, eq(users.id, organizationUsers.userId))
      .where(eq(organizationUsers.orgId, orgId));
  }

  async findPendingInvitesByUser(userId: string) {
    return this.db
      .select(inviteColumns)
      .from(organizationUsers)
      .innerJoin(organizations, eq(organizations.id, organizationUsers.orgId))
      .where(
        and(
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.inviteStatus, InviteStatus.PENDING),
        ),
      );
  }

  async respondToInvite(
    orgId: string,
    userId: string,
    dto: RespondOrganizationInviteDto,
  ) {
    const existing = await this.findMembership(orgId, userId);
    if (!existing || existing.inviteStatus !== InviteStatus.PENDING) {
      throw new NotFoundException(
        'Convite pendente não encontrado para este usuário nesta organização.',
      );
    }

    await this.db
      .update(organizationUsers)
      .set({ inviteStatus: dto.inviteStatus })
      .where(this.membershipWhere(orgId, userId));

    return this.findMemberWithUser(orgId, userId);
  }

  async update(orgId: string, userId: string, dto: UpdateOrganizationUserDto) {
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

    await this.db
      .update(organizationUsers)
      // Campos undefined são ignorados pelo Drizzle, então um PATCH parcial
      // não sobrescreve o que não foi enviado.
      // updatedAt não entra aqui: o schema já tem $onUpdate.
      .set({ role, permission, inviteStatus })
      .where(this.membershipWhere(orgId, userId));

    return this.findMemberWithUser(orgId, userId);
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

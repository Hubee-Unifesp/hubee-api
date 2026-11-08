import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.provider';
import { UsersService } from '../users/users.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  FindAllOrganizationsFilters,
  OrganizationRepository,
} from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly organizationRepository: OrganizationRepository,
    private readonly usersService: UsersService,
  ) {}

  findAll(filters: FindAllOrganizationsFilters) {
    return this.organizationRepository.findAll(filters);
  }

  async findOne(id: string) {
    const organization = await this.organizationRepository.findById(id);
    if (!organization) {
      throw new NotFoundException(`Organização ${id} não encontrada`);
    }
    return organization;
  }

  async create(dto: CreateOrganizationDto, userId: string) {
    await this.ensureRepresentativeExists(userId);

    return this.db.transaction(async (tx) => {
      const organization = await this.organizationRepository.create(
        {
          ...dto,
          representativeId: userId,
        },
        tx,
      );

      await this.organizationRepository.addMember(
        {
          orgId: organization.id,
          userId,
          role: 'admin',
          permission: 'full',
          inviteStatus: 'accepted',
        },
        tx,
      );

      return organization;
    });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    await this.ensureRepresentativeExists(dto.representativeId);
    return this.organizationRepository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.organizationRepository.delete(id);
  }

  /**
   * O banco garante que o representante existe, mas só na hora do INSERT: sem
   * esta checagem o erro de FK subiria como 500. Aqui ele vira 404.
   */
  private async ensureRepresentativeExists(
    representativeId?: string,
  ): Promise<void> {
    if (!representativeId) {
      return;
    }

    try {
      await this.usersService.findOne(representativeId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          `Representante ${representativeId} não encontrado`,
        );
      }
      throw error;
    }
  }
}

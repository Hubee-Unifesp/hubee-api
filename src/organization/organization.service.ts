import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  FindAllOrganizationsFilters,
  OrganizationRepository,
} from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
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

  create(dto: CreateOrganizationDto) {
    return this.organizationRepository.create(dto);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    return this.organizationRepository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.organizationRepository.delete(id);
  }
}

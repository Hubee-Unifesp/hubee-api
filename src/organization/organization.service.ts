import { Injectable, NotFoundException } from '@nestjs/common';
import { UsuariosService } from '../usuarios/usuarios.service';
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
    private readonly usuariosService: UsuariosService,
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

  async create(dto: CreateOrganizationDto) {
    await this.ensureRepresentativeExists(dto.representativeId);
    return this.organizationRepository.create(dto);
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
      await this.usuariosService.findOne(representativeId);
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

import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  type AllowedImageMime,
  type ImageUploadFile,
  validateImageUpload,
} from '../common/validation/image-upload';
import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDatabase } from '../database/database.provider';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  FindAllOrganizationsFilters,
  OrganizationRepository,
} from './organization.repository';

const PHOTO_EXTENSIONS: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly organizationRepository: OrganizationRepository,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
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
    const organization = await this.findOne(id);
    await this.ensureRepresentativeExists(dto.representativeId);
    const updated = await this.organizationRepository.update(id, dto);
    if (dto.photoUrl === null && organization.photoUrl) {
      await this.deletePhoto(organization.photoUrl);
    }
    return updated;
  }

  async updatePhoto(id: string, file?: ImageUploadFile) {
    const { mimetype, buffer } = validateImageUpload(file);
    const organization = await this.findOne(id);
    const photoUrl = await this.uploadPhoto(id, mimetype, buffer);

    let updated: Awaited<ReturnType<OrganizationRepository['update']>>;
    try {
      updated = await this.organizationRepository.update(id, { photoUrl });
    } catch (error) {
      await this.deletePhoto(photoUrl);
      throw error;
    }

    if (organization.photoUrl) {
      await this.deletePhoto(organization.photoUrl);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    // organization_users.organization_id has no ON DELETE action, so the
    // memberships must go first, atomically with the organization itself.
    await this.db.transaction(async (tx) => {
      await this.organizationRepository.deleteMembers(id, tx);
      await this.organizationRepository.delete(id, tx);
    });
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

  private async uploadPhoto(
    organizationId: string,
    mimetype: AllowedImageMime,
    buffer: Buffer,
  ): Promise<string> {
    try {
      return await this.storageService.upload({
        pathname: `organizations/${organizationId}/cover.${PHOTO_EXTENSIONS[mimetype]}`,
        buffer,
        contentType: mimetype,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Falha ao enviar a capa da organização ${organizationId}`,
        error,
      );
      throw new ServiceUnavailableException(
        'Não foi possível enviar a imagem. Tente novamente.',
      );
    }
  }

  private async deletePhoto(url: string): Promise<void> {
    try {
      await this.storageService.delete(url);
    } catch (error) {
      this.logger.warn(`Não foi possível apagar a imagem ${url}: ${error}`);
    }
  }
}

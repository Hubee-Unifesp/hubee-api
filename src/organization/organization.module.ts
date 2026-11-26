import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

@Module({
  imports: [UsersModule, StorageModule],
  controllers: [OrganizationController],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}

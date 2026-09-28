import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { UsersModule } from '../users/users.module';
import { OrganizationUsersController } from './organization-users.controller';
import { OrganizationUsersService } from './organization-users.service';

@Module({
  imports: [OrganizationModule, UsersModule],
  controllers: [OrganizationUsersController],
  providers: [OrganizationUsersService],
})
export class OrganizationUsersModule {}

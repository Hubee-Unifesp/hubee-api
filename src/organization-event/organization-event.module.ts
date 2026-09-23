import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationEventController } from './organization-event.controller';
import { OrganizationEventRepository } from './organization-event.repository';
import { OrganizationEventService } from './organization-event.service';

@Module({
  imports: [EventModule, OrganizationModule],
  controllers: [OrganizationEventController],
  providers: [OrganizationEventRepository, OrganizationEventService],
  exports: [OrganizationEventService],
})
export class OrganizationEventModule {}

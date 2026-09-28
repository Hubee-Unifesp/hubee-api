import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { VenueModule } from '../venue/venue.module';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

@Module({
  imports: [OrganizationModule, VenueModule],
  controllers: [EventController],
  providers: [EventRepository, EventService],
  exports: [EventService],
})
export class EventModule {}

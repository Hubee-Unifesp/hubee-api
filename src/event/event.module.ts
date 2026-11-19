import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { OrganizationModule } from '../organization/organization.module';
import { StorageModule } from '../storage/storage.module';
import { VenueModule } from '../venue/venue.module';
import { EventAiDraftService } from './ai-draft/event-ai-draft.service';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

@Module({
  imports: [AiModule, OrganizationModule, StorageModule, VenueModule],
  controllers: [EventController],
  providers: [EventAiDraftService, EventRepository, EventService],
  exports: [EventService],
})
export class EventModule {}

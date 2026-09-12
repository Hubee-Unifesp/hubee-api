import { Module } from '@nestjs/common';
import { AddressModule } from '../address/address.module';
import { VenueController } from './venue.controller';
import { VenueRepository } from './venue.repository';
import { VenueService } from './venue.service';

@Module({
  imports: [AddressModule],
  controllers: [VenueController],
  providers: [VenueRepository, VenueService],
})
export class VenueModule {}

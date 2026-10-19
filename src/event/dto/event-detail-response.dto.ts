import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationResponseDto } from '../../organization/dto/organization-response.dto';
import { TicketTypeResponseDto } from '../../ticket-type/dto/ticket-type-response.dto';
import { VenueResponseDto } from '../../venue/dto/venue-response.dto';
import { EventResponseDto } from './event-response.dto';

/** Contrato de saída (público) dos detalhes de um evento. */
export class EventDetailResponseDto extends EventResponseDto {
  @Expose()
  @Type(() => VenueResponseDto)
  @ApiProperty({ type: VenueResponseDto })
  venue: VenueResponseDto;

  @Expose()
  @Type(() => OrganizationResponseDto)
  @ApiProperty({ type: OrganizationResponseDto })
  organization: OrganizationResponseDto;

  @Expose()
  @Type(() => TicketTypeResponseDto)
  @ApiProperty({ type: TicketTypeResponseDto, isArray: true })
  ticketTypes: TicketTypeResponseDto[];
}

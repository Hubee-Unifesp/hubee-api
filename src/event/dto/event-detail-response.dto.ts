import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AddressResponseDto } from '../../address/dto/address-response.dto';
import { TicketTypeResponseDto } from '../../ticket-type/dto/ticket-type-response.dto';
import { EventResponseDto } from './event-response.dto';

/** Dados públicos da organização exibidos nos detalhes do evento. */
export class EventDetailOrganizationDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  description: string | null;
}

/** Dados públicos do local exibidos nos detalhes do evento. */
export class EventDetailVenueDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ type: Number })
  maxCapacity: number;

  @Expose()
  @Type(() => AddressResponseDto)
  @ApiProperty({ type: AddressResponseDto })
  address: AddressResponseDto;
}

/** Contrato de saída (público) dos detalhes de um evento. */
export class EventDetailResponseDto extends EventResponseDto {
  @Expose()
  @Type(() => EventDetailVenueDto)
  @ApiProperty({ type: EventDetailVenueDto })
  venue: EventDetailVenueDto;

  @Expose()
  @Type(() => EventDetailOrganizationDto)
  @ApiProperty({ type: EventDetailOrganizationDto })
  organization: EventDetailOrganizationDto;

  @Expose()
  @Type(() => TicketTypeResponseDto)
  @ApiProperty({ type: TicketTypeResponseDto, isArray: true })
  ticketTypes: TicketTypeResponseDto[];
}

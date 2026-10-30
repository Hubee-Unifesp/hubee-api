import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AddressResponseDto } from '../../address/dto/address-response.dto';
import { ticketStatus } from '../../database/schema';

/** Contrato de saída (público) de um ingresso. */
export class TicketResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  qrCode: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  ticketTypeId: string;

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  holderUserId: string | null;

  @Expose()
  @ApiProperty({ enum: ticketStatus.enumValues })
  status: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

/** Local do evento, como aparece no ingresso. */
export class TicketVenueDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @Type(() => AddressResponseDto)
  @ApiProperty({ type: AddressResponseDto })
  address: AddressResponseDto;
}

/** Evento ao qual o ingresso dá acesso. */
export class TicketEventDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  startDate: Date;

  @Expose()
  @ApiProperty()
  endDate: Date;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  photoUrl: string | null;

  @Expose()
  @Type(() => TicketVenueDto)
  @ApiProperty({ type: TicketVenueDto })
  venue: TicketVenueDto;
}

/** Lote do ingresso. */
export class TicketLotDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty()
  batch: string;

  @Expose()
  @ApiProperty({ type: Number })
  price: number;
}

/** Ingresso do usuário logado, com evento, local e lote aninhados. */
export class MyTicketResponseDto extends TicketResponseDto {
  @Expose()
  @Type(() => TicketEventDto)
  @ApiProperty({ type: TicketEventDto })
  event: TicketEventDto;

  @Expose()
  @Type(() => TicketLotDto)
  @ApiProperty({ type: TicketLotDto })
  ticketType: TicketLotDto;
}

import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { organizationEventRole } from '../../database/schema';

/** Contrato de saída (público) de um vínculo organização-evento. */
export class OrganizationEventResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  organizationId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @Expose()
  @ApiProperty({ enum: organizationEventRole.enumValues })
  role: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

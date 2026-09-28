import { ApiProperty } from '@nestjs/swagger';
import { organizationEventRole } from '../../database/schema';

/** Contrato de saída (público) de um vínculo organização-evento. */
export class OrganizationEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  organizationId: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ enum: organizationEventRole.enumValues })
  role: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

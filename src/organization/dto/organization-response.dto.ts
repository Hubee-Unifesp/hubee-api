import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de uma organização. */
export class OrganizationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true, required: false })
  description: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  representativeId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

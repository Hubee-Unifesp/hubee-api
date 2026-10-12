import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um vínculo organização-usuário. */
export class OrganizationUserResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  orgId: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @Expose()
  @ApiProperty()
  role: string;

  @Expose()
  @ApiProperty()
  permission: string;

  @Expose()
  @ApiProperty({ example: 'pending' })
  inviteStatus: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  createdAt: Date | null;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  updatedAt: Date | null;
}

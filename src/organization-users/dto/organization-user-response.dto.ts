import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída (público) de um vínculo organização-usuário. */
export class OrganizationUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  orgId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  permission: string;

  @ApiProperty({ example: 'pending' })
  inviteStatus: string;

  @ApiProperty({ nullable: true, required: false })
  createdAt: Date | null;

  @ApiProperty({ nullable: true, required: false })
  updatedAt: Date | null;
}

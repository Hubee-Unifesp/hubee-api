import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** Convite pendente de organização retornado para o usuário convidado. */
export class UserInviteResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  orgId: string;

  @Expose()
  @ApiProperty({
    example: 'Atlética Unifesp',
    description: 'Nome da organização que enviou o convite',
  })
  organizationName: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @Expose()
  @ApiProperty({ example: 'member' })
  role: string;

  @Expose()
  @ApiProperty({ example: 'full' })
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

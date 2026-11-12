import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SupplierReviewResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  supplierId: string;

  @Expose()
  @ApiProperty({ format: 'uuid', description: 'Organizador que avaliou' })
  userId: string;

  @Expose()
  @ApiProperty({ description: 'Nome do organizador que avaliou' })
  userName: string;

  @Expose()
  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  comment: string | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

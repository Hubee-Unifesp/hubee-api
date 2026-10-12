import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { taskStatus } from '../../database/schema';

/** Contrato de saída (público) de uma tarefa. */
export class TaskResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  responsibleUserId: string | null;

  @Expose()
  @ApiProperty()
  title: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  description: string | null;

  @Expose()
  @ApiProperty({ enum: taskStatus.enumValues })
  status: string;

  @Expose()
  @ApiProperty({ nullable: true, required: false })
  dueDate: Date | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

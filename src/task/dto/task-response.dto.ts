import { ApiProperty } from '@nestjs/swagger';
import { taskStatus } from '../../database/schema';

/** Contrato de saída (público) de uma tarefa. */
export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  responsibleUserId: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, required: false })
  description: string | null;

  @ApiProperty({ enum: taskStatus.enumValues })
  status: string;

  @ApiProperty({ nullable: true, required: false })
  dueDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/pagination/pagination-meta.dto';
import { EventListItemResponseDto } from './event-list-item-response.dto';

export class EventPageResponseDto {
  @Expose()
  @Type(() => EventListItemResponseDto)
  @ApiProperty({ type: EventListItemResponseDto, isArray: true })
  data: EventListItemResponseDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

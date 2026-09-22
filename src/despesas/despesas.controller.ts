import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateDespesaDto } from './dto/create-despesa.dto';
import { QueryDespesaDto } from './dto/query-despesa.dto';
import { UpdateDespesaDto } from './dto/update-despesa.dto';
import { DespesasService } from './despesas.service';

@Controller('eventos/:eventId/despesas')
export class DespesasController {
  constructor(private readonly despesasService: DespesasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateDespesaDto,
  ) {
    return this.despesasService.create(eventId, dto);
  }

  @Get()
  findAll(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: QueryDespesaDto,
  ) {
    return this.despesasService.findAll(eventId, query);
  }

  @Get(':id')
  findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.despesasService.findOne(eventId, id);
  }

  @Patch(':id')
  update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDespesaDto,
  ) {
    return this.despesasService.update(eventId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.despesasService.remove(eventId, id);
  }
}

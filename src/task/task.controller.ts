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
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@Controller('eventos/:eventId/tarefas')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.create(eventId, dto);
  }

  @Get()
  findAll(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: QueryTaskDto,
  ) {
    return this.taskService.findAll(eventId, query);
  }

  @Get(':id')
  findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.taskService.findOne(eventId, id);
  }

  @Patch(':id')
  update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(eventId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.taskService.remove(eventId, id);
  }
}

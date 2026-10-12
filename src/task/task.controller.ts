import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TaskResponseDto } from './dto/task-response.dto';
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
import { toResponse } from '../common/serialization/to-response';

@ApiTags('tasks')
@Controller('events/:eventId/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: TaskResponseDto })
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return toResponse(
      TaskResponseDto,
      await this.taskService.create(eventId, dto),
    );
  }

  @Get()
  @ApiOkResponse({ type: TaskResponseDto, isArray: true })
  async findAll(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: QueryTaskDto,
  ) {
    return toResponse(
      TaskResponseDto,
      await this.taskService.findAll(eventId, query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: TaskResponseDto })
  async findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toResponse(
      TaskResponseDto,
      await this.taskService.findOne(eventId, id),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: TaskResponseDto })
  async update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return toResponse(
      TaskResponseDto,
      await this.taskService.update(eventId, id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.taskService.remove(eventId, id);
  }
}

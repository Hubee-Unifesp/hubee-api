import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ExpenseResponseDto } from './dto/expense-response.dto';
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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';
import { toResponse } from '../common/serialization/to-response';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@ApiTags('expenses')
@AdminOnly()
@Controller('events/:eventId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: ExpenseResponseDto })
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return toResponse(
      ExpenseResponseDto,
      await this.expensesService.create(eventId, dto),
    );
  }

  @Get()
  @ApiOkResponse({ type: ExpenseResponseDto, isArray: true })
  async findAll(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: QueryExpenseDto,
  ) {
    return toResponse(
      ExpenseResponseDto,
      await this.expensesService.findAll(eventId, query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: ExpenseResponseDto })
  async findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toResponse(
      ExpenseResponseDto,
      await this.expensesService.findOne(eventId, id),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: ExpenseResponseDto })
  async update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return toResponse(
      ExpenseResponseDto,
      await this.expensesService.update(eventId, id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.expensesService.remove(eventId, id);
  }
}

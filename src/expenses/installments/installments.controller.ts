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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OrgAccess } from '../../auth/decorators/org-access.decorator';
import { toResponse } from '../../common/serialization/to-response';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { InstallmentResponseDto } from './dto/installment-response.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { InstallmentsService } from './installments.service';

@ApiTags('expenses')
@Controller('events/:eventId')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Get('installments')
  @ApiOperation({
    summary: 'Cronograma de pagamentos do evento',
    description:
      'Todas as parcelas das despesas do evento, da mais antiga para a mais recente.',
  })
  @ApiOkResponse({ type: InstallmentResponseDto, isArray: true })
  async findAllByEvent(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return toResponse(
      InstallmentResponseDto,
      await this.installmentsService.findAllByEvent(eventId),
    );
  }

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Get('expenses/:expenseId/installments')
  @ApiOkResponse({ type: InstallmentResponseDto, isArray: true })
  async findAll(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ) {
    return toResponse(
      InstallmentResponseDto,
      await this.installmentsService.findAllByExpense(eventId, expenseId),
    );
  }

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Get('expenses/:expenseId/installments/:id')
  @ApiOkResponse({ type: InstallmentResponseDto })
  async findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toResponse(
      InstallmentResponseDto,
      await this.installmentsService.findOne(eventId, expenseId, id),
    );
  }

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Post('expenses/:expenseId/installments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra uma parcela da despesa',
    description:
      'A soma das parcelas não canceladas não pode passar do valor da despesa.',
  })
  @ApiCreatedResponse({ type: InstallmentResponseDto })
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: CreateInstallmentDto,
  ) {
    return toResponse(
      InstallmentResponseDto,
      await this.installmentsService.create(eventId, expenseId, dto),
    );
  }

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Patch('expenses/:expenseId/installments/:id')
  @ApiOkResponse({ type: InstallmentResponseDto })
  async update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstallmentDto,
  ) {
    return toResponse(
      InstallmentResponseDto,
      await this.installmentsService.update(eventId, expenseId, id, dto),
    );
  }

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Delete('expenses/:expenseId/installments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.installmentsService.remove(eventId, expenseId, id);
  }
}

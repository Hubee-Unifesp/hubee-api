import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaymentResponseDto } from './dto/payment-response.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentService } from './payment.service';
import { toResponse } from '../common/serialization/to-response';

@ApiTags('payments')
@Controller('orders/:orderId/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: PaymentResponseDto })
  async create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return toResponse(
      PaymentResponseDto,
      await this.paymentService.create(orderId, dto),
    );
  }

  @Get()
  @ApiOkResponse({ type: PaymentResponseDto })
  async findOne(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return toResponse(
      PaymentResponseDto,
      await this.paymentService.findOne(orderId),
    );
  }

  @Patch()
  @ApiOkResponse({ type: PaymentResponseDto })
  async update(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return toResponse(
      PaymentResponseDto,
      await this.paymentService.update(orderId, dto),
    );
  }
}

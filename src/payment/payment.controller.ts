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

@ApiTags('payments')
@Controller('orders/:orderId/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: PaymentResponseDto })
  create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.create(orderId, dto);
  }

  @Get()
  @ApiOkResponse({ type: PaymentResponseDto })
  findOne(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentService.findOne(orderId);
  }

  @Patch()
  @ApiOkResponse({ type: PaymentResponseDto })
  update(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(orderId, dto);
  }
}

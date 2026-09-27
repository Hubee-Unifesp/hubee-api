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

@Controller('orders/:orderId/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.create(orderId, dto);
  }

  @Get()
  findOne(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentService.findOne(orderId);
  }

  @Patch()
  update(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentService.update(orderId, dto);
  }
}

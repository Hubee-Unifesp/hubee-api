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
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

/**
 * O comprador paga pelo checkout (`POST /payments`) e consulta o pagamento do
 * próprio pedido; o service responde 404 para pedido de outra pessoa. Registrar
 * um pagamento à mão aqui e mudar o status (confirmar, recusar, estornar) é só
 * ADMIN: o corpo aceita `amount` e `status`, e confirmar o pagamento é o que
 * libera ingressos.
 */
@ApiTags('payments')
@Controller('orders/:orderId/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @AdminOnly()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: PaymentResponseDto })
  async create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      PaymentResponseDto,
      await this.paymentService.create(orderId, dto, user),
    );
  }

  @Authenticated()
  @Get()
  @ApiOkResponse({ type: PaymentResponseDto })
  async findOne(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      PaymentResponseDto,
      await this.paymentService.findOne(orderId, user),
    );
  }

  @AdminOnly()
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

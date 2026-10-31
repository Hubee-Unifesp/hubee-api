import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { toResponse } from '../common/serialization/to-response';
import { CheckoutDto } from './dto/checkout.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentService } from './payment.service';

/** Checkout: o comprador paga o próprio pedido e recebe os ingressos. */
@ApiTags('payments')
@Controller('payments')
export class CheckoutController {
  constructor(private readonly paymentService: PaymentService) {}

  @Authenticated()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({
    description: 'Pedido inexistente ou de outra pessoa.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Pedido já pago ou cancelado.',
  })
  @ApiConflictResponse({ description: 'Pedido já possui um pagamento.' })
  async checkout(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      PaymentResponseDto,
      await this.paymentService.checkout(dto, user),
    );
  }
}

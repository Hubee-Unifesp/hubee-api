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
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { UpdatePagamentoDto } from './dto/update-pagamento.dto';
import { PagamentoService } from './pagamento.service';

@Controller('orders/:orderId/payments')
export class PagamentoController {
  constructor(private readonly pagamentoService: PagamentoService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePagamentoDto,
  ) {
    return this.pagamentoService.create(orderId, dto);
  }

  @Get()
  findOne(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.pagamentoService.findOne(orderId);
  }

  @Patch()
  update(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdatePagamentoDto,
  ) {
    return this.pagamentoService.update(orderId, dto);
  }
}
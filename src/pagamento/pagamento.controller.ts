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

@Controller('pedidos/:pedidoId/pagamento')
export class PagamentoController {
  constructor(private readonly pagamentoService: PagamentoService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('pedidoId', ParseUUIDPipe) pedidoId: string,
    @Body() dto: CreatePagamentoDto,
  ) {
    return this.pagamentoService.create(pedidoId, dto);
  }

  @Get()
  findOne(@Param('pedidoId', ParseUUIDPipe) pedidoId: string) {
    return this.pagamentoService.findOne(pedidoId);
  }

  @Patch()
  update(
    @Param('pedidoId', ParseUUIDPipe) pedidoId: string,
    @Body() dto: UpdatePagamentoDto,
  ) {
    return this.pagamentoService.update(pedidoId, dto);
  }
}

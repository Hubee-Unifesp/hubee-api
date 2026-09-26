import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { PagamentoController } from './pagamento.controller';
import { PagamentoRepository } from './pagamento.repository';
import { PagamentoService } from './pagamento.service';

@Module({
  imports: [OrderModule],
  controllers: [PagamentoController],
  providers: [PagamentoRepository, PagamentoService],
  exports: [PagamentoService],
})
export class PagamentoModule {}

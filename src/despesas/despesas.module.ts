import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { FornecedoresModule } from '../fornecedores/fornecedores.module';
import { DespesasController } from './despesas.controller';
import { DespesasRepository } from './despesas.repository';
import { DespesasService } from './despesas.service';

@Module({
  imports: [EventModule, FornecedoresModule],
  controllers: [DespesasController],
  providers: [DespesasRepository, DespesasService],
  exports: [DespesasService],
})
export class DespesasModule {}

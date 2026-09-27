import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [EventModule, SuppliersModule],
  controllers: [ExpensesController],
  providers: [ExpensesRepository, ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}

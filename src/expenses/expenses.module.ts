import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';
import { InstallmentsController } from './installments/installments.controller';
import { InstallmentsRepository } from './installments/installments.repository';
import { InstallmentsService } from './installments/installments.service';

@Module({
  imports: [EventModule, SuppliersModule],
  controllers: [ExpensesController, InstallmentsController],
  providers: [
    ExpensesRepository,
    ExpensesService,
    InstallmentsRepository,
    InstallmentsService,
  ],
  exports: [ExpensesService],
})
export class ExpensesModule {}

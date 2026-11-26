import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { PlanningController } from './planning.controller';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

@Module({
  imports: [EventModule],
  controllers: [PlanningController],
  providers: [PlanningRepository, PlanningService],
})
export class PlanningModule {}

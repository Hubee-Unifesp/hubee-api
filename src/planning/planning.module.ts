import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EventModule } from '../event/event.module';
import { PlanningAiController } from './ai/planning-ai.controller';
import { PlanningAiService } from './ai/planning-ai.service';
import { PlanningController } from './planning.controller';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

@Module({
  imports: [EventModule, AiModule],
  controllers: [PlanningController, PlanningAiController],
  providers: [PlanningRepository, PlanningService, PlanningAiService],
})
export class PlanningModule {}

import { Module } from '@nestjs/common';
import { EventModule } from '../event/event.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repository';
import { TaskService } from './task.service';

@Module({
  imports: [EventModule, UsuariosModule],
  controllers: [TaskController],
  providers: [TaskRepository, TaskService],
  exports: [TaskService],
})
export class TaskModule {}

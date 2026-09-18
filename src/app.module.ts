import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { EventModule } from './event/event.module';
import { HealthModule } from './health/health.module';
import { OrderModule } from './order/order.module';
import { OrganizacaoUsuariosModule } from './organizacao-usuarios/organizacao-usuarios.module';
import { OrganizationModule } from './organization/organization.module';
import { TaskModule } from './task/task.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VenueModule } from './venue/venue.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    EventModule,
    HealthModule,
    OrderModule,
    OrganizacaoUsuariosModule,
    OrganizationModule,
    TaskModule,
    UsuariosModule,
    VenueModule,
    FornecedoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

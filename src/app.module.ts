import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OrganizacaoUsuariosModule } from './organizacao-usuarios/organizacao-usuarios.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VenueModule } from './venue/venue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    HealthModule,
    OrganizacaoUsuariosModule,
    UsuariosModule,
    VenueModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

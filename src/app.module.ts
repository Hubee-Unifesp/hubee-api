import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { ExpensesModule } from './expenses/expenses.module';
import { EventModule } from './event/event.module';
import { HealthModule } from './health/health.module';
import { OrderModule } from './order/order.module';
import { OrganizationUsersModule } from './organization-users/organization-users.module';
import { OrganizationEventModule } from './organization-event/organization-event.module';
import { OrganizationModule } from './organization/organization.module';
import { TaskModule } from './task/task.module';
import { PaymentModule } from './payment/payment.module';
import { TicketModule } from './ticket/ticket.module';
import { TicketTypeModule } from './ticket-type/ticket-type.module';
import { UsersModule } from './users/users.module';
import { VenueModule } from './venue/venue.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    ExpensesModule,
    EventModule,
    HealthModule,
    OrderModule,
    OrganizationUsersModule,
    OrganizationEventModule,
    OrganizationModule,
    TaskModule,
    PaymentModule,
    TicketModule,
    TicketTypeModule,
    UsersModule,
    VenueModule,
    SuppliersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

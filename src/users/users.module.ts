import { Global, Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { OrderModule } from '../order/order.module';

@Global()
@Module({
  imports: [forwardRef(() => OrderModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

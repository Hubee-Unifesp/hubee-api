import { Module } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';
import { FornecedoresController } from './fornecedores.controller';

@Module({
  controllers: [FornecedoresController],
  providers: [FornecedoresService],
  exports: [FornecedoresService],
})
export class FornecedoresModule {}

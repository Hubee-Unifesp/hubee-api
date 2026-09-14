import { Test, TestingModule } from '@nestjs/testing';
import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';
import { DRIZZLE } from '../database/database.constants';

describe('FornecedoresController', () => {
  let controller: FornecedoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FornecedoresController],
      providers: [FornecedoresService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    controller = module.get<FornecedoresController>(FornecedoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

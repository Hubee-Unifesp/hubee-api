import { Test, TestingModule } from '@nestjs/testing';
import { FornecedoresService } from './fornecedores.service';
import { DRIZZLE } from '../database/database.constants';

describe('FornecedoresService', () => {
  let service: FornecedoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FornecedoresService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    service = module.get<FornecedoresService>(FornecedoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

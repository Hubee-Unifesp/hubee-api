import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { DRIZZLE } from '../database/database.constants';

describe('SuppliersController', () => {
  let controller: SuppliersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [SuppliersService, { provide: DRIZZLE, useValue: {} }],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

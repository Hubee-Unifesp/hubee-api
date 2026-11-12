import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../database/database.constants';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierResponseDto } from './dto/supplier-response.dto';
import { SupplierReviewResponseDto } from './dto/supplier-review-response.dto';

/** Linha completa do banco, incluindo o campo interno `deletedAt`. */
const row = {
  id: 'supplier-1',
  companyName: 'Som & Luz',
  cnpjCpf: '12345678000190',
  phone: null,
  email: 'contato@someluz.com',
  category: 'infraestrutura',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};
const { deletedAt: _deletedAt, ...publicSupplier } = row;

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let service: {
    create: jest.Mock<SuppliersService['create']>;
    findAll: jest.Mock<SuppliersService['findAll']>;
    findOne: jest.Mock<SuppliersService['findOne']>;
    update: jest.Mock<SuppliersService['update']>;
    remove: jest.Mock<SuppliersService['remove']>;
    saveReview: jest.Mock<SuppliersService['saveReview']>;
    findReviews: jest.Mock<SuppliersService['findReviews']>;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn<SuppliersService['create']>(),
      findAll: jest.fn<SuppliersService['findAll']>(),
      findOne: jest.fn<SuppliersService['findOne']>(),
      update: jest.fn<SuppliersService['update']>(),
      remove: jest.fn<SuppliersService['remove']>(),
      saveReview: jest.fn<SuppliersService['saveReview']>(),
      findReviews: jest.fn<SuppliersService['findReviews']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [SuppliersController],
      providers: [
        { provide: SuppliersService, useValue: service },
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    controller = module.get(SuppliersController);
  });

  it('POST /suppliers retorna o SupplierResponseDto sem deletedAt', async () => {
    const dto = { companyName: 'Som & Luz', cnpjCpf: '12345678000190' };
    service.create.mockResolvedValue(row as never);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual(publicSupplier);
  });

  it('GET /suppliers retorna a lista de SupplierResponseDto', async () => {
    service.findAll.mockResolvedValue([row] as never);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalledWith(undefined);
    expect(result[0]).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual([publicSupplier]);
  });

  it('GET /suppliers repassa os filtros search e category para o service', async () => {
    service.findAll.mockResolvedValue([row] as never);
    const query = { search: 'Som', category: 'infraestrutura' };

    const result = await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([publicSupplier]);
  });

  it('GET /suppliers/:id retorna o SupplierResponseDto sem deletedAt', async () => {
    service.findOne.mockResolvedValue(row as never);

    const result = await controller.findOne('supplier-1');

    expect(service.findOne).toHaveBeenCalledWith('supplier-1');
    expect(result).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual(publicSupplier);
  });

  it('PATCH /suppliers/:id retorna o SupplierResponseDto sem deletedAt', async () => {
    const dto = { category: 'som' };
    const updated = { ...row, ...dto };
    service.update.mockResolvedValue(updated as never);

    const result = await controller.update('supplier-1', dto);

    expect(service.update).toHaveBeenCalledWith('supplier-1', dto);
    expect(result).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual({ ...publicSupplier, ...dto });
  });

  it('DELETE /suppliers/:id delega para suppliersService.remove()', async () => {
    service.remove.mockResolvedValue(undefined as never);

    await controller.remove('supplier-1');

    expect(service.remove).toHaveBeenCalledWith('supplier-1');
  });

  describe('avaliações', () => {
    const user = {
      id: 'user-1',
      email: 'org@example.com',
      role: 'USER' as const,
    };
    const review = {
      id: 'review-1',
      supplierId: 'supplier-1',
      userId: 'user-1',
      userName: 'Organizadora',
      rating: 5,
      comment: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    const response = () => {
      const res = { status: jest.fn() };
      return res as typeof res &
        Parameters<SuppliersController['saveReview']>[3];
    };

    it.each([
      [true, 201],
      [false, 200],
    ])(
      'POST /suppliers/:id/reviews com created=%p responde %p',
      async (created, status) => {
        service.saveReview.mockResolvedValue({ review, created } as never);
        const res = response();

        const result = await controller.saveReview(
          'supplier-1',
          { rating: 5 },
          user,
          res,
        );

        expect(service.saveReview).toHaveBeenCalledWith(
          'supplier-1',
          'user-1',
          {
            rating: 5,
          },
        );
        expect(res.status).toHaveBeenCalledWith(status);
        expect(result).toBeInstanceOf(SupplierReviewResponseDto);
        expect(result).toEqual(review);
      },
    );

    it('GET /suppliers/:id/reviews retorna só os campos do contrato', async () => {
      service.findReviews.mockResolvedValue([
        { ...review, extra: 'interno' },
      ] as never);

      const result = await controller.findReviews('supplier-1');

      expect(service.findReviews).toHaveBeenCalledWith('supplier-1');
      expect(result).toEqual([review]);
    });
  });
});

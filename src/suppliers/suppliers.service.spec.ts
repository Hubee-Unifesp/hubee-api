import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { SuppliersService } from './suppliers.service';
import { DRIZZLE } from '../database/database.constants';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let mockDb: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };

  const supplierRow = {
    id: 'sup-1',
    companyName: 'Buffet Estrela',
    cnpjCpf: '12345678000199',
    phone: '11999999999',
    email: 'contato@estrela.com',
    category: 'Buffet',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('cria fornecedor quando CNPJ/CPF e e-mail não estão em uso', async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      });
      mockDb.insert.mockReturnValue({
        values: () => ({ returning: async () => [supplierRow] }),
      });

      const result = await service.create({
        companyName: 'Buffet Estrela',
        cnpjCpf: '12345678000199',
        email: 'contato@estrela.com',
      });

      expect(result).toEqual(supplierRow);
    });

    it('lança ConflictException quando já existe fornecedor ativo com mesmo CNPJ/CPF ou e-mail', async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: async () => [supplierRow] }) }),
      });

      await expect(
        service.create({
          companyName: 'Outro Buffet',
          cnpjCpf: '12345678000199',
        }),
      ).rejects.toThrow(
        new ConflictException(
          'Já existe um fornecedor com este CNPJ/CPF ou E-mail.',
        ),
      );
    });
  });

  describe('findAll', () => {
    it('lista fornecedores ativos aplicando filtros opcionais', async () => {
      const whereMock = jest.fn(async () => [supplierRow]);
      mockDb.select.mockReturnValue({
        from: () => ({ where: whereMock }),
      });

      const result = await service.findAll({
        search: 'Estrela',
        category: 'Buffet',
      });

      expect(whereMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual([supplierRow]);
    });
  });

  describe('findOne', () => {
    it('retorna fornecedor ativo existente', async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: async () => [supplierRow] }),
      });

      await expect(service.findOne('sup-1')).resolves.toEqual(supplierRow);
    });

    it('lança NotFoundException quando não existe ou está deletado', async () => {
      mockDb.select.mockReturnValue({
        from: () => ({ where: async () => [] }),
      });
      await expect(service.findOne('sup-404')).rejects.toThrow(
        new NotFoundException('Fornecedor não encontrado.'),
      );

      mockDb.select.mockReturnValue({
        from: () => ({
          where: async () => [{ ...supplierRow, deletedAt: new Date() }],
        }),
      });
      await expect(service.findOne('sup-1')).rejects.toThrow(
        new NotFoundException('Fornecedor não encontrado.'),
      );
    });
  });

  describe('avaliações', () => {
    const review = {
      id: 'review-1',
      supplierId: 'sup-1',
      userId: 'user-1',
      userName: 'Organizadora',
      rating: 4,
      comment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    function mockSelects(supplier: object | undefined, reviews: object[] = []) {
      const reviewQuery = {
        from: () => ({
          innerJoin: () => ({
            where: jest.fn(() =>
              Object.assign(Promise.resolve(reviews), {
                orderBy: async () => reviews,
              }),
            ),
          }),
        }),
      };
      mockDb.select
        .mockReturnValueOnce({
          from: () => ({ where: async () => (supplier ? [supplier] : []) }),
        })
        .mockReturnValue(reviewQuery);
    }

    it('saveReview faz upsert pela dupla fornecedor/usuário e devolve created', async () => {
      mockSelects(supplierRow, [review]);
      const onConflictDoUpdate = jest.fn(() => ({
        returning: async () => [{ id: 'review-1', created: false }],
      }));
      const values = jest.fn(() => ({ onConflictDoUpdate }));
      mockDb.insert.mockReturnValue({ values });

      const result = await service.saveReview('sup-1', 'user-1', {
        rating: 4,
        comment: '',
      });

      expect(values).toHaveBeenCalledWith({
        supplierId: 'sup-1',
        userId: 'user-1',
        rating: 4,
        comment: null,
      });
      expect(onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.objectContaining({ rating: 4, comment: null }),
        }),
      );
      expect(result).toEqual({ review, created: false });
    });

    it('saveReview lança NotFoundException para fornecedor removido', async () => {
      mockSelects({ ...supplierRow, deletedAt: new Date() });

      await expect(
        service.saveReview('sup-1', 'user-1', { rating: 5 }),
      ).rejects.toThrow(new NotFoundException('Fornecedor não encontrado.'));
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('findReviews lista as avaliações do fornecedor ativo', async () => {
      mockSelects(supplierRow, [review]);

      await expect(service.findReviews('sup-1')).resolves.toEqual([review]);
    });

    it('findReviews lança NotFoundException para fornecedor inexistente', async () => {
      mockSelects(undefined);

      await expect(service.findReviews('sup-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

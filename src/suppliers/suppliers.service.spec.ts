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
    ratingAverage: null,
    ratingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  function mockSupplierSelectChain(rows: object[]) {
    const orderBy = jest.fn(async () => rows);
    const havingResult = Object.assign(Promise.resolve(rows), { orderBy });
    const having = jest.fn(() => havingResult);
    const groupByResult = Object.assign(Promise.resolve(rows), {
      having,
      orderBy,
    });
    const groupBy = jest.fn(() => groupByResult);
    const where = jest.fn(() => ({ groupBy }));
    const leftJoin = jest.fn(() => ({ where }));
    const from = jest.fn(() => ({ leftJoin }));

    return { from, leftJoin, where, groupBy, having, orderBy };
  }

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
    it('lista fornecedores ativos com agregação de avaliações aplicando filtros opcionais', async () => {
      const chain = mockSupplierSelectChain([supplierRow]);
      mockDb.select.mockReturnValue({ from: chain.from });

      const result = await service.findAll({
        search: 'Estrela',
        category: 'Buffet',
      });

      expect(chain.leftJoin).toHaveBeenCalledTimes(1);
      expect(chain.where).toHaveBeenCalledTimes(1);
      expect(chain.groupBy).toHaveBeenCalledTimes(1);
      expect(chain.having).not.toHaveBeenCalled();
      expect(chain.orderBy).not.toHaveBeenCalled();
      expect(result).toEqual([supplierRow]);
    });

    it('aplica HAVING com minRating e ORDER BY quando sortBy é informado', async () => {
      const ratedSupplier = {
        ...supplierRow,
        ratingAverage: 4.5,
        ratingCount: 2,
      };
      const chain = mockSupplierSelectChain([ratedSupplier]);
      mockDb.select.mockReturnValue({ from: chain.from });

      const result = await service.findAll({
        minRating: 4,
        sortBy: 'rating',
      });

      expect(chain.having).toHaveBeenCalledTimes(1);
      expect(chain.orderBy).toHaveBeenCalledTimes(1);
      expect(result).toEqual([ratedSupplier]);
    });

    it.each(['companyName', 'createdAt'] as const)(
      'ordena quando sortBy=%s',
      async (sortBy) => {
        const chain = mockSupplierSelectChain([supplierRow]);
        mockDb.select.mockReturnValue({ from: chain.from });

        await expect(service.findAll({ sortBy })).resolves.toEqual([
          supplierRow,
        ]);
        expect(chain.orderBy).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('findOne', () => {
    it('retorna fornecedor ativo existente com agregação de avaliações', async () => {
      const chain = mockSupplierSelectChain([supplierRow]);
      mockDb.select.mockReturnValue({ from: chain.from });

      await expect(service.findOne('sup-1')).resolves.toEqual(supplierRow);
      expect(chain.leftJoin).toHaveBeenCalledTimes(1);
      expect(chain.groupBy).toHaveBeenCalledTimes(1);
    });

    it('lança NotFoundException quando não existe ou está deletado', async () => {
      const emptyChain = mockSupplierSelectChain([]);
      mockDb.select.mockReturnValue({ from: emptyChain.from });
      await expect(service.findOne('sup-404')).rejects.toThrow(
        new NotFoundException('Fornecedor não encontrado.'),
      );

      const deletedChain = mockSupplierSelectChain([
        { ...supplierRow, deletedAt: new Date() },
      ]);
      mockDb.select.mockReturnValue({ from: deletedChain.from });
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
      const supplierChain = mockSupplierSelectChain(supplier ? [supplier] : []);
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
        .mockReturnValueOnce({ from: supplierChain.from })
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

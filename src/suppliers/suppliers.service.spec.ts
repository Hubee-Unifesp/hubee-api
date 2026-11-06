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
});

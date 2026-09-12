import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizacaoUsuariosService } from './organizacao-usuarios.service';
import { DRIZZLE } from '../database/database.constants';

describe('OrganizacaoUsuariosService', () => {
  let service: OrganizacaoUsuariosService;

  // "Banco falso": cada método da cadeia por padrão devolve o próprio objeto
  // (pra permitir encadear .select().from().where()...), e a gente sobrescreve
  // o retorno do método final em cada teste com mockResolvedValueOnce.
  const db: any = {
    select: jest.fn(() => db),
    from: jest.fn(() => db),
    where: jest.fn(() => db),
    insert: jest.fn(() => db),
    values: jest.fn(() => db),
    update: jest.fn(() => db),
    set: jest.fn(() => db),
    delete: jest.fn(() => db),
    returning: jest.fn(() => db),
  };

  const orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizacaoUsuariosService,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    service = module.get<OrganizacaoUsuariosService>(
      OrganizacaoUsuariosService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('cria o vínculo quando ele ainda não existe', async () => {
      db.where.mockResolvedValueOnce([]); // findVinculo: nao existe
      db.returning.mockResolvedValueOnce([
        { orgId, userId, papel: 'admin', permissao: 'total' },
      ]);

      const resultado = await service.create(orgId, {
        userId,
        papel: 'admin' as any,
        permissao: 'total' as any,
      });

      expect(resultado).toEqual({
        orgId,
        userId,
        papel: 'admin',
        permissao: 'total',
      });
    });

    it('lança ConflictException quando o vínculo já existe', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]); // ja existe

      await expect(
        service.create(orgId, {
          userId,
          papel: 'admin' as any,
          permissao: 'total' as any,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('retorna a lista de vínculos da organização', async () => {
      const listaFalsa = [{ orgId, userId, papel: 'membro' }];
      db.where.mockResolvedValueOnce(listaFalsa);

      const resultado = await service.findAll(orgId);

      expect(resultado).toEqual(listaFalsa);
    });
  });

  describe('update', () => {
    it('atualiza o vínculo quando ele existe', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]); // findVinculo: existe
      db.returning.mockResolvedValueOnce([
        { orgId, userId, statusConvite: 'aceito' },
      ]);

      const resultado = await service.update(orgId, userId, {
        statusConvite: 'aceito' as any,
      });

      expect(resultado).toEqual({ orgId, userId, statusConvite: 'aceito' });
    });

    it('lança NotFoundException quando o vínculo não existe', async () => {
      db.where.mockResolvedValueOnce([]); // findVinculo: nao existe

      await expect(
        service.update(orgId, userId, { statusConvite: 'aceito' as any }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove o vínculo quando ele existe', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]); // findVinculo: existe

      const resultado = await service.remove(orgId, userId);

      expect(resultado).toEqual({ message: 'Vínculo removido com sucesso.' });
    });

    it('lança NotFoundException quando o vínculo não existe', async () => {
      db.where.mockResolvedValueOnce([]); // findVinculo: nao existe

      await expect(service.remove(orgId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizacaoUsuariosService } from './organizacao-usuarios.service';
import { DRIZZLE } from '../database/database.constants';
import { OrganizationService } from '../organization/organization.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './dto/create-organizacao-usuario.dto';

describe('OrganizacaoUsuariosService', () => {
  let service: OrganizacaoUsuariosService;
  const organizationService = { findOne: jest.fn(async () => ({})) };
  const usuariosService = { findOne: jest.fn(async () => ({})) };

  // "Banco falso": cada método da cadeia por padrão devolve o próprio objeto
  // (pra permitir encadear .select().from().where()...), e a gente sobrescreve
  // o retorno do método final em cada teste com mockResolvedValueOnce.
  //
  // Atenção: este mock não valida SQL. Ele serve pra checar ramificações
  // (conflito, não encontrado) e QUAIS campos são passados pro banco.
  // A persistência de verdade é coberta no .integration.spec.ts.
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

  const dtoCriacao = {
    userId,
    role: OrganizationRole.ADMIN,
    permission: OrganizationPermission.FULL,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizacaoUsuariosService,
        { provide: DRIZZLE, useValue: db },
        { provide: OrganizationService, useValue: organizationService },
        { provide: UsuariosService, useValue: usuariosService },
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
        {
          orgId,
          userId,
          role: OrganizationRole.ADMIN,
          permission: OrganizationPermission.FULL,
        },
      ]);

      const resultado = await service.create(orgId, dtoCriacao);

      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId,
          userId,
          role: OrganizationRole.ADMIN,
          permission: OrganizationPermission.FULL,
        }),
      );
      expect(resultado).toEqual({
        orgId,
        userId,
        role: OrganizationRole.ADMIN,
        permission: OrganizationPermission.FULL,
      });
    });

    it('lança ConflictException quando o vínculo já existe', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]); // ja existe

      await expect(service.create(orgId, dtoCriacao)).rejects.toThrow(
        ConflictException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('propaga NotFoundException quando a organização não existe', async () => {
      organizationService.findOne.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(service.create(orgId, dtoCriacao)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('propaga NotFoundException quando o usuário não existe', async () => {
      usuariosService.findOne.mockRejectedValueOnce(new NotFoundException());

      await expect(service.create(orgId, dtoCriacao)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retorna a lista de vínculos da organização', async () => {
      const listaFalsa = [{ orgId, userId, role: OrganizationRole.MEMBER }];
      db.where.mockResolvedValueOnce(listaFalsa);

      const resultado = await service.findAll(orgId);

      expect(resultado).toEqual(listaFalsa);
    });

    it('propaga NotFoundException quando a organização não existe', async () => {
      organizationService.findOne.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(service.findAll(orgId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('grava os campos enviados no .set()', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]); // findVinculo: existe
      db.returning.mockResolvedValueOnce([
        { orgId, userId, inviteStatus: InviteStatus.ACCEPTED },
      ]);

      const resultado = await service.update(orgId, userId, {
        inviteStatus: InviteStatus.ACCEPTED,
      });

      // Este é o assert que pegaria a regressão original (só updated_at gravado)
      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({ inviteStatus: InviteStatus.ACCEPTED }),
      );
      expect(resultado).toEqual({
        orgId,
        userId,
        inviteStatus: InviteStatus.ACCEPTED,
      });
    });

    it('grava role e permission juntos', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]);
      db.returning.mockResolvedValueOnce([{ orgId, userId }]);

      await service.update(orgId, userId, {
        role: OrganizationRole.MEMBER,
        permission: OrganizationPermission.READ_ONLY,
      });

      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          role: OrganizationRole.MEMBER,
          permission: OrganizationPermission.READ_ONLY,
        }),
      );
    });

    it('lança BadRequestException quando o body está vazio', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]);

      await expect(service.update(orgId, userId, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(db.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o vínculo não existe', async () => {
      db.where.mockResolvedValueOnce([]); // findVinculo: nao existe

      await expect(
        service.update(orgId, userId, {
          inviteStatus: InviteStatus.ACCEPTED,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove o vínculo quando ele existe', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]); // findVinculo: existe

      const resultado = await service.remove(orgId, userId);

      expect(db.delete).toHaveBeenCalled();
      expect(resultado).toEqual({ message: 'Vínculo removido com sucesso.' });
    });

    it('lança NotFoundException quando o vínculo não existe', async () => {
      db.where.mockResolvedValueOnce([]); // findVinculo: nao existe

      await expect(service.remove(orgId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.delete).not.toHaveBeenCalled();
    });
  });
});

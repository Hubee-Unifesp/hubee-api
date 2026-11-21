import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationUsersService } from './organization-users.service';
import { DRIZZLE } from '../database/database.constants';
import { OrganizationService } from '../organization/organization.service';
import { UsersService } from '../users/users.service';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './dto/create-organization-user.dto';

describe('OrganizationUsersService', () => {
  let service: OrganizationUsersService;
  const orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const mockUser = {
    id: userId,
    fullName: 'Maria Silva',
    email: 'maria@exemplo.com',
    status: 'ACTIVE',
  };

  const organizationService = { findOne: jest.fn(async () => ({})) };
  const usersService = {
    findOne: jest.fn(async () => mockUser),
    findByEmail: jest.fn<
      (email: string) => Promise<typeof mockUser | undefined>
    >(async () => mockUser),
  };

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
    innerJoin: jest.fn(() => db),
    where: jest.fn(() => db),
    insert: jest.fn(() => db),
    values: jest.fn(() => db),
    update: jest.fn(() => db),
    set: jest.fn(() => db),
    delete: jest.fn(() => db),
    returning: jest.fn(() => db),
  };

  const dtoCriacao = {
    email: 'maria@exemplo.com',
    role: OrganizationRole.ADMIN,
    permission: OrganizationPermission.FULL,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    db.where.mockReset().mockImplementation(() => db);
    db.returning.mockReset().mockImplementation(() => db);
    usersService.findByEmail.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationUsersService,
        { provide: DRIZZLE, useValue: db },
        { provide: OrganizationService, useValue: organizationService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<OrganizationUsersService>(OrganizationUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('cria o convite como pending buscando usuário por email', async () => {
      db.where.mockResolvedValueOnce([]); // findMembership: nao existe
      db.returning.mockResolvedValueOnce([
        {
          orgId,
          userId,
          role: OrganizationRole.ADMIN,
          permission: OrganizationPermission.FULL,
          inviteStatus: InviteStatus.PENDING,
        },
      ]);

      const resultado = await service.create(orgId, dtoCriacao);

      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'maria@exemplo.com',
      );
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId,
          userId,
          role: OrganizationRole.ADMIN,
          permission: OrganizationPermission.FULL,
          inviteStatus: InviteStatus.PENDING,
        }),
      );
      expect(resultado).toEqual({
        orgId,
        userId,
        userName: 'Maria Silva',
        userEmail: 'maria@exemplo.com',
        role: OrganizationRole.ADMIN,
        permission: OrganizationPermission.FULL,
        inviteStatus: InviteStatus.PENDING,
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

    it('lança NotFoundException quando nenhum usuário ativo é encontrado para o email', async () => {
      usersService.findByEmail.mockResolvedValueOnce(undefined);

      await expect(service.create(orgId, dtoCriacao)).rejects.toThrow(
        NotFoundException,
      );

      usersService.findByEmail.mockResolvedValueOnce({
        ...mockUser,
        status: 'INACTIVE',
      });

      await expect(service.create(orgId, dtoCriacao)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retorna a lista de vínculos da organização com userName e userEmail', async () => {
      const listaFalsa = [
        {
          orgId,
          userId,
          userName: 'Maria Silva',
          userEmail: 'maria@exemplo.com',
          role: OrganizationRole.MEMBER,
        },
      ];
      db.where.mockResolvedValueOnce(listaFalsa);

      const resultado = await service.findAll(orgId);

      expect(db.innerJoin).toHaveBeenCalled();
      expect(resultado).toEqual(listaFalsa);
    });

    it('propaga NotFoundException quando a organização não existe', async () => {
      organizationService.findOne.mockRejectedValueOnce(
        new NotFoundException(),
      );

      await expect(service.findAll(orgId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPendingInvitesByUser', () => {
    it('retorna os convites pendentes do usuário com nome da organização', async () => {
      const convites = [
        {
          orgId,
          organizationName: 'Atlética Unifesp',
          userId,
          role: OrganizationRole.MEMBER,
          permission: OrganizationPermission.FULL,
          inviteStatus: InviteStatus.PENDING,
        },
      ];
      db.where.mockResolvedValueOnce(convites);

      const resultado = await service.findPendingInvitesByUser(userId);

      expect(db.innerJoin).toHaveBeenCalled();
      expect(resultado).toEqual(convites);
    });
  });

  describe('respondToInvite', () => {
    it('aceita ou recusa convite pendente e retorna dados atualizados', async () => {
      const atualizado = {
        orgId,
        userId,
        userName: 'Maria Silva',
        userEmail: 'maria@exemplo.com',
        inviteStatus: InviteStatus.ACCEPTED,
      };
      db.where
        .mockResolvedValueOnce([
          { orgId, userId, inviteStatus: InviteStatus.PENDING },
        ])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([atualizado]);

      const resultado = await service.respondToInvite(orgId, userId, {
        inviteStatus: InviteStatus.ACCEPTED,
      });

      expect(db.set).toHaveBeenCalledWith({
        inviteStatus: InviteStatus.ACCEPTED,
      });
      expect(resultado).toEqual(atualizado);
    });

    it('lança NotFoundException quando não existe convite pendente', async () => {
      db.where.mockResolvedValueOnce([]);

      await expect(
        service.respondToInvite(orgId, userId, {
          inviteStatus: InviteStatus.ACCEPTED,
        }),
      ).rejects.toThrow(NotFoundException);

      db.where.mockResolvedValueOnce([
        { orgId, userId, inviteStatus: InviteStatus.ACCEPTED },
      ]);

      await expect(
        service.respondToInvite(orgId, userId, {
          inviteStatus: InviteStatus.REJECTED,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('grava os campos enviados no .set()', async () => {
      const atualizado = {
        orgId,
        userId,
        userName: 'Maria Silva',
        userEmail: 'maria@exemplo.com',
        inviteStatus: InviteStatus.ACCEPTED,
      };
      db.where
        .mockResolvedValueOnce([{ orgId, userId }]) // findMembership: existe
        .mockResolvedValueOnce(undefined) // update().where()
        .mockResolvedValueOnce([atualizado]); // findMemberWithUser

      const resultado = await service.update(orgId, userId, {
        inviteStatus: InviteStatus.ACCEPTED,
      });

      // Este é o assert que pegaria a regressão original (só updated_at gravado)
      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({ inviteStatus: InviteStatus.ACCEPTED }),
      );
      expect(resultado).toEqual(atualizado);
    });

    it('grava role e permission juntos', async () => {
      const atualizado = {
        orgId,
        userId,
        role: OrganizationRole.MEMBER,
        permission: OrganizationPermission.READ_ONLY,
      };
      db.where
        .mockResolvedValueOnce([{ orgId, userId }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([atualizado]);

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
      db.where.mockResolvedValueOnce([]); // findMembership: nao existe

      await expect(
        service.update(orgId, userId, {
          inviteStatus: InviteStatus.ACCEPTED,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove o vínculo quando ele existe', async () => {
      db.where.mockResolvedValueOnce([{ orgId, userId }]); // findMembership: existe

      const resultado = await service.remove(orgId, userId);

      expect(db.delete).toHaveBeenCalled();
      expect(resultado).toBeUndefined();
    });

    it('lança NotFoundException quando o vínculo não existe', async () => {
      db.where.mockResolvedValueOnce([]); // findMembership: nao existe

      await expect(service.remove(orgId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.delete).not.toHaveBeenCalled();
    });
  });
});

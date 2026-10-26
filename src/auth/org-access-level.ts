import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from '../organization-users/dto/create-organization-user.dto';

/** Níveis de acesso a uma organização; cada nível inclui os anteriores. */
export type OrgAccessLevel = 'read' | 'write' | 'manage';

export const ORG_ACCESS_KEY = 'orgAccess';

/** De onde o guard tira a organização que está sendo acessada. */
export type OrgAccessSource =
  /** Param da rota que já é o id da organização (padrão: `orgId`). */
  | { from: 'org'; param?: string }
  /**
   * Param da rota que é o id do evento (padrão: `eventId`); usa
   * `events.organizer_id`. Quem não é membro da organização recebe 404.
   */
  | { from: 'event'; param?: string }
  /** Campo do body com o id da organização (padrão: `organizerId`). */
  | { from: 'body'; field?: string };

export interface OrgAccessMetadata {
  level: OrgAccessLevel;
  source: OrgAccessSource;
}

const LEVEL_RANK: Record<OrgAccessLevel, number> = {
  read: 1,
  write: 2,
  manage: 3,
};

export interface OrganizationMembership {
  role: string;
  permission: string;
  inviteStatus: string;
}

/**
 * Nível efetivo do vínculo: só convite aceito conta; sem `permission = full`
 * fica em `read`; com `full`, `role = admin` dá `manage` e o resto `write`.
 * A `permission` vem antes do `role` para que uma linha inconsistente
 * (`admin` com `read_only`) não ganhe `manage`.
 */
export function effectiveLevel(
  membership: OrganizationMembership,
): OrgAccessLevel | null {
  if (membership.inviteStatus !== InviteStatus.ACCEPTED) return null;
  if (membership.permission !== OrganizationPermission.FULL) return 'read';
  if (membership.role === OrganizationRole.ADMIN) return 'manage';
  return 'write';
}

export function satisfiesLevel(
  level: OrgAccessLevel | null,
  required: OrgAccessLevel,
): boolean {
  return level !== null && LEVEL_RANK[level] >= LEVEL_RANK[required];
}

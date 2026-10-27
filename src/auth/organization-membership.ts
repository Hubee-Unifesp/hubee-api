import { and, eq } from 'drizzle-orm';
import type { DbExecutor } from '../database/database.provider';
import { organizations, organizationUsers } from '../database/schema';
import { InviteStatus } from '../organization-users/dto/create-organization-user.dto';
import {
  effectiveLevel,
  type OrgAccessLevel,
  type OrganizationMembership,
} from './org-access-level';

/**
 * Vínculo do usuário com a organização, só se o convite foi aceito. Usado pelo
 * `OrganizationAccessGuard` e pelos services que mostram mais a membros.
 */
export async function findAcceptedMembership(
  db: DbExecutor,
  userId: string,
  organizationId: string,
): Promise<OrganizationMembership | undefined> {
  const [membership] = await db
    .select({
      role: organizationUsers.role,
      permission: organizationUsers.permission,
      inviteStatus: organizationUsers.inviteStatus,
    })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.orgId, organizationId),
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.inviteStatus, InviteStatus.ACCEPTED),
      ),
    );
  return membership;
}

export interface UserOrganization {
  orgId: string;
  organizationName: string;
  role: string;
  permission: string;
  level: OrgAccessLevel;
}

/** Organizações em que o usuário tem convite aceito, com o nível efetivo. */
export async function findUserOrganizations(
  db: DbExecutor,
  userId: string,
): Promise<UserOrganization[]> {
  const rows = await db
    .select({
      orgId: organizationUsers.orgId,
      organizationName: organizations.name,
      role: organizationUsers.role,
      permission: organizationUsers.permission,
      inviteStatus: organizationUsers.inviteStatus,
    })
    .from(organizationUsers)
    .innerJoin(organizations, eq(organizations.id, organizationUsers.orgId))
    .where(
      and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.inviteStatus, InviteStatus.ACCEPTED),
      ),
    )
    .orderBy(organizations.name);

  return rows.flatMap(({ inviteStatus, ...org }) => {
    const level = effectiveLevel({ ...org, inviteStatus });
    return level ? [{ ...org, level }] : [];
  });
}

import type { AuthenticatedUser } from './decorators/current-user.decorator';

/** ADMIN acessa tudo; os demais só o que tem um dos `ownerIds` igual ao seu. */
export function canAccess(
  user: AuthenticatedUser,
  ...ownerIds: (string | null | undefined)[]
): boolean {
  return user.role === 'ADMIN' || ownerIds.includes(user.id);
}

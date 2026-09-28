import { IsIn, IsUUID } from 'class-validator';
import { organizationEventRole } from '../../database/schema';
import type { OrganizationEventRole } from '../../database/schema';

export class CreateOrganizationEventDto {
  @IsUUID()
  organizationId: string;

  @IsIn(organizationEventRole.enumValues)
  role: OrganizationEventRole;
}

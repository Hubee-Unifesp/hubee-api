import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { InviteStatus } from './create-organization-user.dto';

export const INVITE_DECISION_STATUSES = [
  InviteStatus.ACCEPTED,
  InviteStatus.REJECTED,
] as const;

export type InviteDecisionStatus = (typeof INVITE_DECISION_STATUSES)[number];

export class RespondOrganizationInviteDto {
  @ApiProperty({
    enum: INVITE_DECISION_STATUSES,
    example: InviteStatus.ACCEPTED,
    description: 'Decisão do usuário convidado sobre o convite pendente',
  })
  @IsIn(INVITE_DECISION_STATUSES, {
    message: 'inviteStatus deve ser accepted ou rejected.',
  })
  inviteStatus: InviteDecisionStatus;
}

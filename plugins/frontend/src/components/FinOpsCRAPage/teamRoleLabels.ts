import type { TeamMemberRole } from '../../types';

export function teamRoleLabel(role: TeamMemberRole): string {
  if (role === 'product_manager') {
    return 'Product manager';
  }
  if (role === 'team_lead') {
    return 'Team lead';
  }
  return 'Manager';
}

import { Box, Flex, Text } from '@backstage/ui';
import type { TeamItem, TeamMemberItem } from '../../../types';
import { teamRoleLabel } from '../teamRoleLabels';

function memberLineLabel(member: TeamMemberItem): string {
  const label = member.name?.trim();
  return label && label.length > 0 ? label : member.person_id;
}

export type FinOpsCraScopeTeamsSectionProps = {
  teams: TeamItem[];
  /** When set (e.g. batch API failed), parent shows a single warning; hide per-scope content. */
  omitAttribution?: boolean;
  showTitle?: boolean;
};

export function FinOpsCraScopeTeamsSection(props: FinOpsCraScopeTeamsSectionProps) {
  if (props.omitAttribution) {
    return null;
  }

  if (props.teams.length === 0) {
    return (
      <Box style={{ marginBottom: 12 }}>
        <Text as="div" variant="body-x-small" color="secondary">
          No team allocations reference this scope.
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ marginBottom: 12 }}>
      {props.showTitle !== false ? (
        <Text as="div" variant="body-x-small" color="secondary" style={{ marginBottom: 6 }}>
          Teams & roles
        </Text>
      ) : null}
      <Flex direction="column" gap="3">
        {props.teams.map(team => (
          <Box key={team.id}>
            <Text as="div" variant="body-small" weight="bold">
              {team.name}
            </Text>
            {(team.members?.length ?? 0) > 0 ? (
              <ul
                style={{
                  margin: '6px 0 0 0',
                  paddingLeft: '1.1rem',
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {team.members!.map(m => (
                  <li key={`${team.id}-${m.person_id}-${m.role}`} style={{ marginBottom: 4 }}>
                    <Text as="span" variant="body-small">
                      {memberLineLabel(m)}
                    </Text>
                    <Text as="span" variant="body-x-small" color="secondary">
                      {' '}
                      — {teamRoleLabel(m.role)}
                    </Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text as="div" variant="body-x-small" color="secondary" style={{ marginTop: 4 }}>
                No people listed for this team.
              </Text>
            )}
          </Box>
        ))}
      </Flex>
    </Box>
  );
}

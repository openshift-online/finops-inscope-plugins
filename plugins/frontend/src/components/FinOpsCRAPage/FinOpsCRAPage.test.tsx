import { renderInTestApp } from '@backstage/frontend-test-utils';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFinOpsDataSource } from '../../data/finopsDataSource';
import { MOCK_TEAM_AWS, MOCK_TEAM_FULL } from '../../mock/finopsCraMockData';
import { FinOpsCRAPage } from './FinOpsCRAPage';

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, amount: number): Date {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

describe('FinOpsCRAPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/finops/cra');
  });

  it('renders scope and date filters', async () => {
    const now = new Date();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const scopeSelect = await screen.findByLabelText('Scope');
    expect(within(scopeSelect).getByRole('option', { name: 'All scopes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toHaveValue(toIsoDate(addDays(now, -29)));
    expect(screen.getByLabelText('To date')).toHaveValue(toIsoDate(now));
    expect(screen.getByLabelText('Cost metric')).toHaveValue('amortized_amount');
    expect(screen.getByRole('checkbox', { name: 'EC2 usage hours' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'RDS usage hours' })).toBeInTheDocument();
  });

  it('loads teams and enables the team filter', async () => {
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const teamSelect = await screen.findByLabelText('Team');
    expect(teamSelect).not.toBeDisabled();
    expect(within(teamSelect).getByRole('option', { name: 'All teams' })).toBeInTheDocument();
    expect(
      within(teamSelect).getByRole('option', { name: 'Full platform (mock)' }),
    ).toBeInTheDocument();
  });

  it('does not show people and roles in filters when a team is selected', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const teamSelect = await screen.findByLabelText('Team');
    await user.selectOptions(teamSelect, MOCK_TEAM_FULL);
    await waitFor(() => {
      expect(screen.queryByText('People & roles')).not.toBeInTheDocument();
      expect(screen.queryByText('dev_lead')).not.toBeInTheDocument();
      expect(screen.queryByText(/— Manager/)).not.toBeInTheDocument();
      expect(screen.queryByText('pm_one')).not.toBeInTheDocument();
    });
  });

  it('narrows scope options when the AWS-only mock team is selected', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const teamSelect = await screen.findByLabelText('Team');
    await user.selectOptions(teamSelect, MOCK_TEAM_AWS);
    const scopeSelect = await screen.findByLabelText('Scope');
    expect(within(scopeSelect).queryByRole('option', { name: 'RHOBS GCP Analytics' })).not.toBeInTheDocument();
    expect(within(scopeSelect).getByRole('option', { name: 'RHOBS AWS Prod' })).toBeInTheDocument();
  });

  it('applies quick date presets', async () => {
    const user = userEvent.setup();
    const now = new Date();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const fromDateInput = (await screen.findByLabelText('From date')) as HTMLInputElement;
    const toDateInput = (await screen.getByLabelText('To date')) as HTMLInputElement;

    await user.click(screen.getByRole('button', { name: 'Past month' }));
    expect(fromDateInput.value).not.toBe(toIsoDate(addDays(now, -29)));
    expect(toDateInput.value).not.toBe(toIsoDate(now));

    await user.click(screen.getByRole('button', { name: 'Last 30 days' }));
    expect(fromDateInput.value).toBe(toIsoDate(addDays(now, -29)));
    expect(toDateInput.value).toBe(toIsoDate(now));

    await user.click(screen.getByRole('button', { name: 'Last 7 days of data' }));
    await waitFor(() => {
      expect(fromDateInput.value).not.toBe('');
      expect(toDateInput.value).not.toBe('');
    });
  });

  it('filters provider types', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const scopeSelect = await screen.findByLabelText('Scope');
    expect(within(scopeSelect).queryByRole('option', { name: 'RHOBS GCP Analytics' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'GCP' }));
    expect(within(scopeSelect).queryByRole('option', { name: 'RHOBS GCP Analytics' })).not.toBeInTheDocument();
  });

  it('shows usage hours on the chart when the scope has usage metrics', async () => {
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const usageHints = await screen.findAllByText(
      /Usage: EC2 usage \(hrs\), RDS usage \(hrs\) \(right axis\)\./,
    );
    expect(usageHints.length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('EC2 usage (hrs)')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('RDS usage (hrs)')).length).toBeGreaterThanOrEqual(1);
  });

  it('opens teams and roles popup from each scope chart title', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const openButtons = await screen.findAllByRole('button', { name: 'Teams & roles' });
    expect(openButtons.length).toBeGreaterThanOrEqual(4);

    await user.click(openButtons[0]);
    expect(await screen.findByRole('dialog', { name: /Teams and roles for/i })).toBeInTheDocument();
    expect(screen.getByText('Full platform (mock)')).toBeInTheDocument();
    expect(screen.getByText('RHOBS AWS subtree (mock)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows teams and roles link only for scopes with team attribution', async () => {
    const dataSourceWithoutOneScopeAttribution = {
      ...mockFinOpsDataSource,
      getScopeTeamsBySlug: async (scopeSlugs: readonly string[]) => {
        const full = await mockFinOpsDataSource.getScopeTeamsBySlug(scopeSlugs);
        return {
          ...full,
          'rhobs.dynatrace.global': [],
        };
      },
    };

    await renderInTestApp(<FinOpsCRAPage dataSource={dataSourceWithoutOneScopeAttribution} />);

    expect(await screen.findByRole('heading', { name: 'RHOBS Dynatrace Global' })).toBeInTheDocument();
    const openButtons = await screen.findAllByRole('button', { name: 'Teams & roles' });
    expect(openButtons.length).toBe(3);
  });

  it('renders one trend chart per scope when All scopes is selected', async () => {
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    expect(await screen.findByRole('heading', { name: 'RHOBS AWS Prod' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RHOBS AWS Dev' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RHOBS GCP Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RHOBS Dynatrace Global' })).toBeInTheDocument();
  });

  it('omits usage hours when the scope has no usage metrics', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    const scopeSelect = await screen.findByLabelText('Scope');
    await user.selectOptions(scopeSelect, 'rhobs.dynatrace.global');

    await waitFor(() => {
      expect(screen.queryByText(/Usage:.*\(right axis\)\./)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('EC2 usage (hrs)')).not.toBeInTheDocument();
    expect(screen.queryByText('RDS usage (hrs)')).not.toBeInTheDocument();
  });

  it('lets the user switch cost and usage metrics', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    await screen.findByLabelText('Scope');

    await user.selectOptions(screen.getByLabelText('Cost metric'), 'amortized_amount');
    await waitFor(() => {
      expect(screen.getAllByText('Total Amortized cost').length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('checkbox', { name: 'EC2 usage hours' }));
    expect(
      await screen.findByText(/Usage: RDS usage \(hrs\) \(right axis\)\./),
    ).toBeInTheDocument();
  });

  it('hydrates filters from URL query params', async () => {
    window.history.replaceState(
      {},
      '',
      '/finops/cra?from=2025-02-01&to=2025-02-28&providers=aws&team=team-full&scope=rhobs.aws.prod&costMetric=amortized_amount&usageMetrics=rds_usage_hours_amount',
    );

    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    expect((await screen.findByLabelText('From date')).toHaveValue('2025-02-01');
    expect(screen.getByLabelText('To date')).toHaveValue('2025-02-28');
    expect(screen.getByLabelText('Team')).toHaveValue('team-full');
    expect(screen.getByLabelText('Scope')).toHaveValue('rhobs.aws.prod');
    expect(screen.getByLabelText('Cost metric')).toHaveValue('amortized_amount');
    expect(screen.getByRole('checkbox', { name: 'AWS' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'GCP' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'EC2 usage hours' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'RDS usage hours' })).toBeChecked();
  });

  it('keeps URL query params in sync when filters change', async () => {
    const user = userEvent.setup();
    await renderInTestApp(<FinOpsCRAPage dataSource={mockFinOpsDataSource} />);

    await user.selectOptions(await screen.findByLabelText('Team'), 'team-full');
    await user.selectOptions(screen.getByLabelText('Scope'), 'rhobs.aws.dev');
    await user.selectOptions(screen.getByLabelText('Cost metric'), 'amortized_amount');
    await user.click(screen.getByRole('checkbox', { name: 'RDS usage hours' }));
    await user.click(screen.getByRole('checkbox', { name: 'GCP' }));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('team')).toBe('team-full');
      expect(params.get('scope')).toBe('rhobs.aws.dev');
      expect(params.get('costMetric')).toBe('amortized_amount');
      expect(params.get('providers')).toBe('aws,dynatrace,other');
      expect(params.get('usageMetrics')).toBe('ec2_usage_hours_amount');
      expect(params.get('from')).toBeTruthy();
      expect(params.get('to')).toBeTruthy();
    });
  });
});

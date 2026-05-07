import { Container, Header } from '@backstage/ui';
import type { CSSProperties } from 'react';

const cardStyle: CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 16,
  minWidth: 240,
};

const linkStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: 12,
  color: '#2563eb',
  textDecoration: 'none',
  fontWeight: 600,
};

export const FinOpsLandingPage = () => {
  return (
    <>
      <Header title="FinOps" />
      <Container>
        <p>Select a FinOps subpage.</p>
        <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <article style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>FinOps CRA</h3>
            <p style={{ margin: 0 }}>Cloud resources allocation dashboard and trends.</p>
            <a href="/finops/cra" style={linkStyle}>
              Open FinOps CRA
            </a>
          </article>

          <article style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>FinOps ROSA</h3>
            <p style={{ margin: 0 }}>
              Temporary mockup page for ROSA-specific FinOps insights.
            </p>
            <a href="/finops/rosa" style={linkStyle}>
              Open FinOps ROSA
            </a>
          </article>
        </section>
      </Container>
    </>
  );
};

export const FinOpsROSAPage = () => {
  return (
    <>
      <Header title="FinOps ROSA" />
      <Container>
        <p>
          This is a temporary mockup page. We can replace it with real ROSA cost and
          usage data next.
        </p>
        <a href="/finops" style={linkStyle}>
          Back to FinOps
        </a>
      </Container>
    </>
  );
};

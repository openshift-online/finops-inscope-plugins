import { Box, Card, CardBody, CardHeader, Text } from '@backstage/ui';
import type { ReactNode } from 'react';

type FinOpsFiltersSidebarProps = {
  children: ReactNode;
};

export function FinOpsFiltersSidebar({ children }: FinOpsFiltersSidebarProps) {
  return (
    <Box
      width={{ initial: '100%', md: 'auto' }}
      maxWidth={{ initial: 'min(100%, 19rem)', md: '19rem' }}
      mx={{ initial: 'auto', md: '0' }}
      style={{ flexShrink: 0 }}
    >
      <Card>
        <CardHeader>
          <Text as="h2" variant="title-small" weight="bold">
            Filters
          </Text>
        </CardHeader>
        <CardBody>{children}</CardBody>
      </Card>
    </Box>
  );
}

import React from 'react';
import { Container } from '@mui/material';
import { InternalUsersList } from '@/components/Users/InternalUsersList';

export const InternalUsersPage: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <InternalUsersList />
    </Container>
  );
};

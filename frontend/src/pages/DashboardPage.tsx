import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Skeleton,
  Alert,
  Button,
} from '@mui/material';
import {
  People as PeopleIcon,
  ConfirmationNumber as TicketIcon,
  CheckCircle as CheckCircleIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '@/api/clients';
import { ticketsApi } from '@/api/tickets';
import { assetsApi } from '@/api/assets';
import { portalClientsApi } from '@/api/portalClients';
import { portalTicketsApi } from '@/api/portalTickets';
import { portalAssetsApi } from '@/api/portalAssets';
import { useAuth } from '@/contexts/AuthContext';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'primary.main',
  isLoading,
}) => {
  return (
    <Paper
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: color,
          opacity: 0.2,
          fontSize: 48,
        }}
      >
        {icon}
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {isLoading ? (
        <Skeleton variant="text" width={80} height={56} />
      ) : (
        <Typography variant="h3" component="div" sx={{ mb: 1, fontWeight: 600 }}>
          {value}
        </Typography>
      )}
      {subtitle && !isLoading && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
};

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Determine if we're a portal user
  const isPortalUser = user?.user_type === 'portal';

  const {
    data: clientsData,
    isLoading: isLoadingClients,
    error: clientsError,
    refetch: refetchClients,
  } = useQuery({
    queryKey: ['dashboard-clients', isPortalUser ? 'portal' : 'admin'],
    queryFn: async () => {
      if (isPortalUser) {
        return portalClientsApi.list();
      }
      return clientsApi.listClients({ page: 1, page_size: 1 });
    },
  });

  const {
    data: ticketsData,
    isLoading: isLoadingTickets,
    error: ticketsError,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ['dashboard-tickets', isPortalUser ? 'portal' : 'admin'],
    queryFn: async () => {
      if (isPortalUser) {
        return portalTicketsApi.list({ page: 1, page_size: 100 });
      }
      return ticketsApi.listTickets({ page: 1, page_size: 100 });
    },
  });

  const {
    data: assetsData,
    isLoading: isLoadingAssets,
    error: assetsError,
    refetch: refetchAssets,
  } = useQuery({
    queryKey: ['dashboard-assets', isPortalUser ? 'portal' : 'admin'],
    queryFn: async () => {
      if (isPortalUser) {
        return portalAssetsApi.list({ page: 1, page_size: 1 });
      }
      return assetsApi.listAssets({ page: 1, page_size: 1 });
    },
  });

  const totalClients = clientsData?.total ?? 0;
  const totalTickets = ticketsData?.total ?? 0;
  const totalAssets = assetsData?.total ?? 0;

  const openTickets = ticketsData?.items.filter((t) => !t.closed_at).length ?? 0;
  const closedTickets = ticketsData?.items.filter((t) => t.closed_at).length ?? 0;

  const hasError = clientsError || ticketsError || assetsError;

  const handleRetry = () => {
    refetchClients();
    refetchTickets();
    refetchAssets();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('dashboard.title')}
      </Typography>

      {hasError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              {t('dashboard.retry')}
            </Button>
          }
        >
          {t('dashboard.errorLoading')}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.totalClients')}
            value={totalClients}
            icon={<PeopleIcon />}
            color="primary.main"
            isLoading={isLoadingClients}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.openTickets')}
            value={openTickets}
            subtitle={t('dashboard.ofTotal', { total: totalTickets })}
            icon={<TicketIcon />}
            color="warning.main"
            isLoading={isLoadingTickets}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.closedTickets')}
            value={closedTickets}
            subtitle={t('dashboard.ofTotal', { total: totalTickets })}
            icon={<CheckCircleIcon />}
            color="success.main"
            isLoading={isLoadingTickets}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('dashboard.totalAssets')}
            value={totalAssets}
            icon={<InventoryIcon />}
            color="info.main"
            isLoading={isLoadingAssets}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

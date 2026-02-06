import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  CardActions,
  Typography,
  Stack,
  Fab,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  LocationOn as LocationOnIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { SiteForm } from './SiteForm';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuth } from '@/contexts/AuthContext';

interface SitesListProps {
  clientId: string;
}

export const SitesList: React.FC<SitesListProps> = ({ clientId }) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const isPortalUser = user?.user_type === 'portal';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sites', clientId, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser ? portalClientsApi.listSites(clientId) : clientsApi.listSites(clientId),
  });

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  // Mobile Card component for site
  const SiteCard: React.FC<{ site: any }> = ({ site }) => (
    <Card
      variant="outlined"
      data-testid={`site-card-${site.id}`}
      sx={{
        borderRadius: 2,
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        {/* Site Name + Default Badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
            {site.name}
          </Typography>
          {site.is_default && (
            <Chip
              label={t('sites.isDefault')}
              size="small"
              color="primary"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {/* Address */}
        {site.address && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              {site.address}
            </Typography>
          </Box>
        )}
      </CardContent>
      <CardActions sx={{ pt: 0, px: 2, pb: 1.5, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<EditIcon sx={{ fontSize: 16 }} />}
          onClick={() => setEditingSite(site)}
        >
          {t('app.edit')}
        </Button>
      </CardActions>
    </Card>
  );

  return (
    <Box>
      {/* Header with Add button - desktop only */}
      {!isMobile && (
        <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="create-site-button"
          >
            {t('sites.create')}
          </Button>
        </Box>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress size={28} />
        </Box>
      ) : data?.items.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography color="text.secondary">{t('sites.noSites')}</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="create-site-button"
            sx={{ mt: 1.5 }}
          >
            {t('sites.create')}
          </Button>
        </Paper>
      ) : isMobile ? (
        /* Mobile: Card view */
        <Stack spacing={1.5}>
          {data?.items.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </Stack>
      ) : (
        /* Desktop/Tablet: Table view */
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem' }}>
                  {t('sites.name')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem' }}>
                  {t('sites.address')}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem', width: 80 }}>
                  {t('app.actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((site) => (
                <TableRow key={site.id} data-testid={`site-row-${site.id}`} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                  <TableCell sx={{ py: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {site.name}
                      </Typography>
                      {site.is_default && (
                        <Chip
                          label={t('sites.isDefault')}
                          size="small"
                          color="primary"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {site.address || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => setEditingSite(site)}
                      sx={{ p: 0.5 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Mobile FAB for adding */}
      {isMobile && data && data.items.length > 0 && (
        <Fab
          color="primary"
          size="medium"
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="create-site-button"
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 1000,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      <SiteForm
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          refetch();
        }}
        clientId={clientId}
      />

      {editingSite && (
        <SiteForm
          open={true}
          onClose={() => setEditingSite(null)}
          onSuccess={() => {
            setEditingSite(null);
            refetch();
          }}
          clientId={clientId}
          site={editingSite}
        />
      )}
    </Box>
  );
};

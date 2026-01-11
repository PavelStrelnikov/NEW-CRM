import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsApi } from '@/api/clients';
import { ClientForm } from './ClientForm';
import { SitesList } from './SitesList';
import { ContactsList } from './ContactsList';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);

  const { data: client, isLoading, error, refetch } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsApi.getClient(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !client) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any)?.message || 'Client not found'}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/clients')}
        >
          {t('app.back')}
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {client.name}
        </Typography>
        <Button variant="contained" onClick={() => setIsEditDialogOpen(true)}>
          {t('app.edit')}
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('clients.taxId')}
            </Typography>
            <Typography variant="body1">{client.tax_id || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('clients.phone')}
            </Typography>
            <Typography variant="body1">{client.main_phone || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('clients.email')}
            </Typography>
            <Typography variant="body1">{client.main_email || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('clients.isActive')}
            </Typography>
            <Chip
              label={client.is_active ? t('clients.isActive') : 'Inactive'}
              color={client.is_active ? 'success' : 'default'}
              size="small"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              {t('clients.address')}
            </Typography>
            <Typography variant="body1">{client.main_address || '-'}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label={t('sites.title')} />
          <Tab label={t('contacts.title')} />
        </Tabs>
      </Box>

      {currentTab === 0 && <SitesList clientId={client.id} />}
      {currentTab === 1 && <ContactsList clientId={client.id} />}

      <ClientForm
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          refetch();
        }}
        client={client}
      />
    </Box>
  );
};

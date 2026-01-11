import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Link,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { assetsApi } from '@/api/assets';
import { clientsApi } from '@/api/clients';
import { ticketsApi } from '@/api/tickets';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';

export const AssetDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showError } = useToast();
  const locale = i18n.language;
  const [currentTab, setCurrentTab] = useState(0);

  // Fetch asset
  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.getAsset(id!),
    enabled: !!id,
  });

  // Fetch asset types
  const { data: assetTypes } = useQuery({
    queryKey: ['asset-types'],
    queryFn: () => assetsApi.listAssetTypes(),
  });

  // Fetch client info
  const { data: client } = useQuery({
    queryKey: ['client', asset?.client_id],
    queryFn: () => clientsApi.getClient(asset!.client_id),
    enabled: !!asset?.client_id,
  });

  // Fetch site info
  const { data: site } = useQuery({
    queryKey: ['site', asset?.site_id],
    queryFn: () => clientsApi.getSite(asset!.site_id),
    enabled: !!asset?.site_id,
  });

  // Fetch ticket statuses for linked tickets
  const { data: statuses } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: () => ticketsApi.listTicketStatuses(),
  });

  // Create lookup maps
  const assetTypeMap = useMemo(() => {
    if (!assetTypes) return new Map();
    return new Map(assetTypes.map(t => [t.code, t]));
  }, [assetTypes]);

  const statusMap = useMemo(() => {
    if (!statuses) return new Map();
    return new Map(statuses.map(s => [s.id, s]));
  }, [statuses]);

  // Helper functions
  const getAssetTypeName = (code: string): string => {
    const type = assetTypeMap.get(code);
    if (!type) return code;
    return locale === 'he' ? type.display_name_he : type.display_name_en;
  };

  const getStatusLabel = (statusId: string): string => {
    const status = statusMap.get(statusId);
    if (!status) return statusId;
    return locale === 'he' ? status.name_he : status.name_en;
  };

  // Show error toast if needed
  React.useEffect(() => {
    if (error) {
      showError(t('app.error') + ': ' + ((error as any)?.message || 'Failed to load asset'));
    }
  }, [error, showError, t]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!asset) {
    return (
      <Alert severity="error">
        {t('app.error')}: Asset not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header with back button */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/assets')}
        >
          {t('app.back')}
        </Button>
      </Box>

      {/* Asset Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" gutterBottom>
            {asset.label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={getAssetTypeName(asset.asset_type_code)} size="small" color="primary" />
            <Chip label={asset.status} size="small" />
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('clients.title')}
            </Typography>
            {client ? (
              <Link
                component="button"
                variant="body1"
                onClick={() => navigate(`/clients/${asset.client_id}`)}
                sx={{ textAlign: 'start' }}
              >
                {client.name}
              </Link>
            ) : (
              <Typography variant="body1">{asset.client_id}</Typography>
            )}
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.site')}
            </Typography>
            <Typography variant="body1">{site?.name || asset.site_id}</Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.manufacturer')}
            </Typography>
            <Typography variant="body1">{asset.manufacturer || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.model')}
            </Typography>
            <Typography variant="body1">{asset.model || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.serialNumber')}
            </Typography>
            <Typography variant="body1">{asset.serial_number || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.installDate')}
            </Typography>
            <Typography variant="body1">
              {asset.install_date
                ? format(new Date(asset.install_date), 'dd/MM/yyyy')
                : '-'}
            </Typography>
          </Grid>

          {asset.notes && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                {t('assets.notes')}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {asset.notes}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label={t('assets.properties')} />
          <Tab label={t('assets.linkedTickets')} />
          <Tab label={t('activity.title')} />
        </Tabs>
      </Box>

      {/* Tab 0: Properties */}
      {currentTab === 0 && (
        <Paper>
          {asset.properties && asset.properties.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('assets.properties')}</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asset.properties.map((prop) => (
                    <TableRow key={prop.key}>
                      <TableCell>{prop.label}</TableCell>
                      <TableCell>
                        {prop.data_type === 'secret'
                          ? '***SECRET***'
                          : prop.value?.toString() || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box p={3} textAlign="center">
              <Typography color="text.secondary">{t('assets.noAssets')}</Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Tab 1: Linked Tickets */}
      {currentTab === 1 && (
        <Paper>
          {asset.linked_tickets && asset.linked_tickets.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('tickets.ticketNumber')}</TableCell>
                    <TableCell>{t('tickets.titleField')}</TableCell>
                    <TableCell>{t('tickets.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asset.linked_tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{ticket.ticket_number}</TableCell>
                      <TableCell>{ticket.title}</TableCell>
                      <TableCell>
                        <Chip label={getStatusLabel(ticket.status_id)} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box p={3} textAlign="center">
              <Typography color="text.secondary">{t('tickets.noTickets')}</Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Tab 2: Activity/Audit */}
      {currentTab === 2 && (
        <Paper>
          <List>
            {asset.events && asset.events.length > 0 ? (
              asset.events.map((event, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={event.message || event.action}
                      secondary={format(new Date(event.created_at || new Date()), 'dd/MM/yyyy HH:mm')}
                    />
                  </ListItem>
                </React.Fragment>
              ))
            ) : (
              <Box p={3} textAlign="center">
                <Typography color="text.secondary">{t('activity.noEvents')}</Typography>
              </Box>
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
};

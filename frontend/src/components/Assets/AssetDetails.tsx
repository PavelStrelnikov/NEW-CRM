import React, { useState } from 'react';
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
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { assetsApi } from '@/api/assets';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { format } from 'date-fns';

export const AssetDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.getAsset(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !asset) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any)?.message || 'Asset not found'}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/assets')}
        >
          {t('app.back')}
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {asset.label}
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.type')}
            </Typography>
            <Typography variant="body1">{asset.asset_type_code}</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.status')}
            </Typography>
            <Typography variant="body1">{asset.status}</Typography>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.manufacturer')}
            </Typography>
            <Typography variant="body1">{asset.manufacturer || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.model')}
            </Typography>
            <Typography variant="body1">{asset.model || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.serialNumber')}
            </Typography>
            <Typography variant="body1">{asset.serial_number || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.installDate')}
            </Typography>
            <Typography variant="body1">
              {asset.install_date
                ? format(new Date(asset.install_date), 'dd/MM/yyyy')
                : '-'}
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              {t('assets.notes')}
            </Typography>
            <Typography variant="body1">{asset.notes || '-'}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label={t('assets.properties')} />
          <Tab label={t('assets.linkedTickets')} />
        </Tabs>
      </Box>

      {currentTab === 0 && (
        <Paper>
          {asset.properties && asset.properties.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Property</TableCell>
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
            <Box p={2}>
              <Typography color="text.secondary">No properties</Typography>
            </Box>
          )}
        </Paper>
      )}

      {currentTab === 1 && (
        <Paper>
          {asset.linked_tickets && asset.linked_tickets.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Ticket Number</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
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
                      <TableCell>{ticket.status_id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box p={2}>
              <Typography color="text.secondary">No linked tickets</Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

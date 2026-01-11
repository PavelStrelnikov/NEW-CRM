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
  TextField,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { Edit as EditIcon, Visibility as ViewIcon, Block as BlockIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients';
import { ClientForm } from './ClientForm';
import { useState as useConfirmState } from 'react';

export const ClientsList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', searchQuery, page],
    queryFn: () => clientsApi.listClients({ q: searchQuery, page, page_size: 25 }),
  });

  const handleToggleActive = async (clientId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (window.confirm(t(`clients.confirm${action.charAt(0).toUpperCase() + action.slice(1)}`))) {
      try {
        await clientsApi.updateClient(clientId, { is_active: !currentStatus });
        refetch();
      } catch (err) {
        alert(t('app.error'));
      }
    }
  };

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{t('clients.title')}</Typography>
        <Button
          variant="contained"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          {t('clients.create')}
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder={t('clients.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
        />
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('clients.name')}</TableCell>
                <TableCell>{t('clients.taxId')}</TableCell>
                <TableCell>{t('clients.phone')}</TableCell>
                <TableCell>{t('clients.email')}</TableCell>
                <TableCell>{t('clients.isActive')}</TableCell>
                <TableCell align="center">{t('app.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {t('clients.noClients')}
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((client) => (
                  <TableRow key={client.id} hover>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>{client.tax_id || '-'}</TableCell>
                    <TableCell>{client.main_phone || '-'}</TableCell>
                    <TableCell>{client.main_email || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={client.is_active ? t('clients.isActive') : 'Inactive'}
                        color={client.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/clients/${client.id}`)}
                        title={t('app.edit')}
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleActive(client.id, client.is_active)}
                        title={client.is_active ? t('clients.deactivate') : t('clients.activate')}
                        color={client.is_active ? 'error' : 'success'}
                      >
                        {client.is_active ? <BlockIcon /> : <CheckCircleIcon />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('app.loading')}: {data.items.length} / {data.total}
          </Typography>
        </Box>
      )}

      <ClientForm
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          refetch();
        }}
      />
    </Box>
  );
};

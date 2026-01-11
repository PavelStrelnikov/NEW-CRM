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
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients';
import { SiteForm } from './SiteForm';

interface SitesListProps {
  clientId: string;
}

export const SitesList: React.FC<SitesListProps> = ({ clientId }) => {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sites', clientId],
    queryFn: () => clientsApi.listSites(clientId),
  });

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => setIsCreateDialogOpen(true)}>
          {t('sites.create')}
        </Button>
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
                <TableCell>{t('sites.name')}</TableCell>
                <TableCell>{t('sites.address')}</TableCell>
                <TableCell align="center">{t('app.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    {t('sites.noSites')}
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((site) => (
                  <TableRow key={site.id} hover>
                    <TableCell>
                      {site.name}
                      {site.is_default && (
                        <Chip
                          label={t('sites.isDefault')}
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{site.address || '-'}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => setEditingSite(site)}
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
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

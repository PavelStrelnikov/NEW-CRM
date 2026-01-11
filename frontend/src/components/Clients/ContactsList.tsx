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
import { ContactForm } from './ContactForm';

interface ContactsListProps {
  clientId: string;
}

export const ContactsList: React.FC<ContactsListProps> = ({ clientId }) => {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contacts', clientId],
    queryFn: () => clientsApi.listContacts(clientId),
  });

  // Fetch sites to display site names
  const { data: sitesData } = useQuery({
    queryKey: ['sites', clientId],
    queryFn: () => clientsApi.listSites(clientId),
  });

  // Create a map of site id to site name
  const sitesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    sitesData?.items.forEach(site => {
      map[site.id] = site.name;
    });
    return map;
  }, [sitesData]);

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
          {t('contacts.create')}
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
                <TableCell>{t('contacts.name')}</TableCell>
                <TableCell>{t('contacts.position')}</TableCell>
                <TableCell>{t('contacts.phone')}</TableCell>
                <TableCell>{t('contacts.email')}</TableCell>
                <TableCell>{t('contacts.sites')}</TableCell>
                <TableCell align="center">{t('app.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {t('contacts.noContacts')}
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((contact) => (
                  <TableRow key={contact.id} hover>
                    <TableCell>{contact.name}</TableCell>
                    <TableCell>{contact.position || '-'}</TableCell>
                    <TableCell>{contact.phone || '-'}</TableCell>
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>
                      {contact.applies_to_all_sites ? (
                        <Chip label={t('contacts.allSites')} size="small" color="primary" />
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {contact.site_ids?.map((siteId) => (
                            <Chip
                              key={siteId}
                              label={sitesMap[siteId] || siteId}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => setEditingContact(contact)}
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

      <ContactForm
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          refetch();
        }}
        clientId={clientId}
      />

      {editingContact && (
        <ContactForm
          open={true}
          onClose={() => setEditingContact(null)}
          onSuccess={() => {
            setEditingContact(null);
            refetch();
          }}
          clientId={clientId}
          contact={editingContact}
        />
      )}
    </Box>
  );
};

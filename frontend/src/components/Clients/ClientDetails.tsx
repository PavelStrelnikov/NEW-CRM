import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Stack,
  Card,
  CardContent,
  Link,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { ClientForm } from './ClientForm';
import { SitesList } from './SitesList';
import { ContactsList } from './ContactsList';
import { ClientAssetsList } from './ClientAssetsList';
import { ConfirmDeleteDialog } from '../Common/ConfirmDeleteDialog';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { ClientDeletionSummary } from '@/types';
import { copyToClipboard as copyText } from '@/utils/clipboard';

// Readable monospace font stack for technical data
const MONO_FONT = '"SF Mono", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace';

export const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isMobile, isDesktop } = useResponsive();
  const isRTL = i18n.language === 'he';
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletionSummary, setDeletionSummary] = useState<ClientDeletionSummary | null>(null);

  // Copy to clipboard helper
  const handleCopy = async (text: string) => {
    const success = await copyText(text);
    if (success) {
      showSuccess(t('assets.copied'));
    } else {
      showError(t('app.copyError'));
    }
  };

  // Check if user is admin (only admins can delete)
  const isAdmin = user?.role === 'admin';
  const isPortalUser = user?.user_type === 'portal';

  const { data: client, isLoading, error, refetch } = useQuery({
    queryKey: ['client', id, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser ? portalClientsApi.get(id!) : clientsApi.getClient(id!),
    enabled: !!id,
  });

  // Deletion summary query
  const deletionSummaryQuery = useQuery({
    queryKey: ['clientDeletionSummary', id],
    queryFn: () => clientsApi.getClientDeletionSummary(id!),
    enabled: false, // Only fetch when user clicks delete
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (force: boolean) => clientsApi.deleteClient(id!, force),
    onSuccess: () => {
      showSuccess(t('delete.success'));
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate('/clients');
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t('delete.error'));
    },
  });

  // Handle delete button click
  const handleDeleteClick = async () => {
    const result = await deletionSummaryQuery.refetch();
    if (result.data) {
      setDeletionSummary(result.data);
      setDeleteDialogOpen(true);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (force: boolean) => {
    deleteMutation.mutate(force);
  };

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
      {/* ================================================================== */}
      {/* COMPACT HEADER BAR */}
      {/* ================================================================== */}
      <Box sx={{
        mb: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon sx={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />}
          onClick={() => navigate('/clients')}
          sx={{ minWidth: 'auto' }}
        >
          {t('app.back')}
        </Button>

        {/* Actions */}
        {isMobile ? (
          <Stack direction="row" spacing={0.75}>
            <IconButton
              color="primary"
              size="small"
              onClick={() => setIsEditDialogOpen(true)}
              sx={{ border: 1, borderColor: 'primary.main' }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            {isAdmin && (
              <IconButton
                color="error"
                size="small"
                onClick={handleDeleteClick}
                disabled={deletionSummaryQuery.isFetching || deleteMutation.isPending}
                sx={{ border: 1, borderColor: 'error.main' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setIsEditDialogOpen(true)}
            >
              {t('app.edit')}
            </Button>
            {isAdmin && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteClick}
                disabled={deletionSummaryQuery.isFetching || deleteMutation.isPending}
              >
                {t('app.delete')}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* ================================================================== */}
      {/* CLIENT INFO CARD - Responsive Design */}
      {/* ================================================================== */}
      <Card variant="outlined" sx={{ mb: 1.5 }}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          {/* Row 1: Title + Status Badge */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            mb: 1.5,
          }}>
            <BusinessIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
              {client.name}
            </Typography>
            <Chip
              label={client.is_active ? t('clients.isActive') : t('clients.inactive')}
              color={client.is_active ? 'success' : 'default'}
              size="small"
              sx={{ height: 24, fontSize: '0.75rem' }}
            />
          </Box>

          {/* Row 2: Key Info Grid - responsive */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',           // Mobile: single column
              sm: 'repeat(2, 1fr)', // Tablet: 2 columns
              md: 'repeat(4, 1fr)', // Desktop: 4 columns
            },
            gap: { xs: 1.5, sm: 2 },
            pt: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}>
            {/* Tax ID */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', mb: 0.25 }}>
                {t('clients.taxId')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: MONO_FONT, fontSize: '0.9375rem' }} dir="ltr">
                  {client.tax_id || '—'}
                </Typography>
                {client.tax_id && (
                  <Tooltip title={t('app.copy')}>
                    <IconButton size="small" onClick={() => handleCopy(client.tax_id!)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Phone */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', mb: 0.25 }}>
                {t('clients.phone')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PhoneIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                {client.main_phone ? (
                  <Link
                    href={`tel:${client.main_phone}`}
                    underline="hover"
                    sx={{ fontWeight: 500, fontFamily: MONO_FONT, fontSize: '0.9375rem' }}
                    dir="ltr"
                  >
                    {client.main_phone}
                  </Link>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>—</Typography>
                )}
                {client.main_phone && (
                  <Tooltip title={t('app.copy')}>
                    <IconButton size="small" onClick={() => handleCopy(client.main_phone!)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Email */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', mb: 0.25 }}>
                {t('clients.email')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                <EmailIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                {client.main_email ? (
                  <Link
                    href={`mailto:${client.main_email}`}
                    underline="hover"
                    sx={{
                      fontWeight: 500,
                      fontSize: '0.9375rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    dir="ltr"
                  >
                    {client.main_email}
                  </Link>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>—</Typography>
                )}
                {client.main_email && (
                  <Tooltip title={t('app.copy')}>
                    <IconButton size="small" onClick={() => handleCopy(client.main_email!)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 }, flexShrink: 0 }}>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Address */}
            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1', md: 'auto' } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', mb: 0.25 }}>
                {t('clients.address')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.9375rem',
                    lineHeight: 1.4,
                    ...(isDesktop && {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }),
                  }}
                >
                  {client.main_address || '—'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* TABS - Compact */}
      {/* ================================================================== */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }}>
        <Tabs
          value={currentTab}
          onChange={(_, v) => setCurrentTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
          sx={{ minHeight: 36 }}
        >
          <Tab label={t('sites.title')} sx={{ minHeight: 36, py: 0.5, fontSize: '0.85rem' }} />
          <Tab label={t('contacts.title')} sx={{ minHeight: 36, py: 0.5, fontSize: '0.85rem' }} />
          <Tab label={t('assets.title')} sx={{ minHeight: 36, py: 0.5, fontSize: '0.85rem' }} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {currentTab === 0 && <SitesList clientId={client.id} />}
      {currentTab === 1 && <ContactsList clientId={client.id} />}
      {currentTab === 2 && <ClientAssetsList clientId={client.id} />}

      <ClientForm
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          refetch();
        }}
        client={client}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog<ClientDeletionSummary>
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletionSummary(null);
        }}
        onConfirm={handleDeleteConfirm}
        isLoading={deletionSummaryQuery.isFetching}
        isDeleting={deleteMutation.isPending}
        title={t('delete.clientTitle')}
        entityName={client.name}
        entityType={t('clients.client')}
        summary={deletionSummary}
        requireNameConfirmation={true}
        renderSummaryDetails={(summary) => (
          <Table size="small" sx={{ mb: 2 }}>
            <TableBody>
              <TableRow>
                <TableCell><strong>{t('clients.name')}:</strong></TableCell>
                <TableCell>{summary.client_name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>{t('delete.sites')}:</strong></TableCell>
                <TableCell>{summary.usage.sites_count}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>{t('delete.contacts')}:</strong></TableCell>
                <TableCell>{summary.usage.contacts_count}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>{t('delete.clientUsers')}:</strong></TableCell>
                <TableCell>{summary.usage.client_users_count}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>{t('delete.tickets')}:</strong></TableCell>
                <TableCell>
                  {summary.usage.tickets_total}
                  {summary.usage.tickets_open > 0 && (
                    <Chip
                      label={`${summary.usage.tickets_open} open`}
                      size="small"
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>{t('delete.assets')}:</strong></TableCell>
                <TableCell>{summary.usage.assets_count}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>{t('delete.projects')}:</strong></TableCell>
                <TableCell>{summary.usage.projects_count}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      />
    </Box>
  );
};

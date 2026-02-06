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
  Link,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  ContentCopy as ContentCopyIcon,
  WhatsApp as WhatsAppIcon,
  PhoneInTalk as PhoneCallIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { ContactForm } from './ContactForm';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { copyToClipboard as copyText } from '@/utils/clipboard';

// Readable monospace font stack for technical data
const MONO_FONT = '"SF Mono", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace';

interface ContactsListProps {
  clientId: string;
}

export const ContactsList: React.FC<ContactsListProps> = ({ clientId }) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const { showSuccess, showError } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const isPortalUser = user?.user_type === 'portal';

  // Copy to clipboard helper with mobile fallback
  const handleCopy = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyText(text);
    if (success) {
      showSuccess(t('assets.copied'));
    } else {
      showError(t('app.copyError'));
    }
  };

  // Helper to format phone number for WhatsApp (remove spaces, dashes, etc.)
  const formatPhoneForWhatsApp = (phone: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    // If it starts with 0, replace with country code (assuming Israel +972)
    if (cleaned.startsWith('0')) {
      cleaned = '+972' + cleaned.substring(1);
    }
    // If it doesn't start with +, add +972
    if (!cleaned.startsWith('+')) {
      cleaned = '+972' + cleaned;
    }
    return cleaned;
  };

  // Open WhatsApp
  const openWhatsApp = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const formattedPhone = formatPhoneForWhatsApp(phone);
    // Try WhatsApp Business first, then regular WhatsApp
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contacts', clientId, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser ? portalClientsApi.listContacts(clientId) : clientsApi.listContacts(clientId),
  });

  // Fetch sites to display site names
  const { data: sitesData } = useQuery({
    queryKey: ['sites', clientId, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser ? portalClientsApi.listSites(clientId) : clientsApi.listSites(clientId),
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

  // Mobile Card component for contact
  const ContactCard: React.FC<{ contact: any }> = ({ contact }) => (
    <Card
      variant="outlined"
      data-testid={`contact-card-${contact.id}`}
      sx={{
        borderRadius: 2,
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        {/* Contact Name + Position */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
            {contact.name}
          </Typography>
        </Box>

        {/* Position */}
        {contact.position && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            <WorkIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {contact.position}
            </Typography>
          </Box>
        )}

        {/* Phone */}
        {contact.phone && (
          <Box sx={{ mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <PhoneIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography
                variant="body2"
                sx={{ fontFamily: MONO_FONT, fontSize: '0.875rem', flex: 1 }}
                dir="ltr"
              >
                {contact.phone}
              </Typography>
            </Box>
            {/* Quick action buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Tooltip title={t('contacts.call')}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PhoneCallIcon />}
                  href={`tel:${contact.phone}`}
                  sx={{
                    flex: 1,
                    minHeight: 40,
                    borderColor: 'success.main',
                    color: 'success.main',
                    '&:hover': {
                      borderColor: 'success.dark',
                      backgroundColor: 'success.50',
                    }
                  }}
                >
                  {t('contacts.call')}
                </Button>
              </Tooltip>
              <Tooltip title={t('contacts.whatsapp')}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<WhatsAppIcon />}
                  onClick={(e) => openWhatsApp(contact.phone, e)}
                  sx={{
                    flex: 1,
                    minHeight: 40,
                    borderColor: '#25D366',
                    color: '#25D366',
                    '&:hover': {
                      borderColor: '#128C7E',
                      backgroundColor: '#e8f5e9',
                    }
                  }}
                >
                  WhatsApp
                </Button>
              </Tooltip>
              <Tooltip title={t('app.copy')}>
                <IconButton
                  size="medium"
                  onClick={(e) => handleCopy(contact.phone, e)}
                  sx={{
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    minHeight: 40,
                    minWidth: 40,
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Email */}
        {contact.email && (
          <Box sx={{ mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <EmailIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
                dir="ltr"
              >
                {contact.email}
              </Typography>
            </Box>
            {/* Email action button */}
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Tooltip title={t('contacts.sendEmail')}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EmailIcon />}
                  href={`mailto:${contact.email}`}
                  sx={{
                    flex: 1,
                    minHeight: 40,
                    borderColor: 'info.main',
                    color: 'info.main',
                    '&:hover': {
                      borderColor: 'info.dark',
                      backgroundColor: 'info.50',
                    }
                  }}
                >
                  {t('contacts.sendEmail')}
                </Button>
              </Tooltip>
              <Tooltip title={t('app.copy')}>
                <IconButton
                  size="medium"
                  onClick={(e) => handleCopy(contact.email, e)}
                  sx={{
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    minHeight: 40,
                    minWidth: 40,
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Sites */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {contact.applies_to_all_sites ? (
            <Chip label={t('contacts.allSites')} size="small" color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />
          ) : (
            contact.site_ids?.map((siteId: string) => (
              <Chip
                key={siteId}
                label={sitesMap[siteId] || siteId}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            ))
          )}
        </Box>
      </CardContent>
      <CardActions sx={{ pt: 0, px: 2, pb: 1.5, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<EditIcon sx={{ fontSize: 16 }} />}
          onClick={() => setEditingContact(contact)}
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
            data-testid="create-contact-button"
          >
            {t('contacts.create')}
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
          <Typography color="text.secondary">{t('contacts.noContacts')}</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="create-contact-button"
            sx={{ mt: 1.5 }}
          >
            {t('contacts.create')}
          </Button>
        </Paper>
      ) : isMobile ? (
        /* Mobile: Card view */
        <Stack spacing={1.5}>
          {data?.items.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </Stack>
      ) : (
        /* Desktop/Tablet: Table view */
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem' }}>
                  {t('contacts.name')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem' }}>
                  {t('contacts.position')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem' }}>
                  {t('contacts.phone')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem' }}>
                  {t('contacts.email')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem' }}>
                  {t('contacts.sites')}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem', width: 80 }}>
                  {t('app.actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((contact) => (
                <TableRow key={contact.id} data-testid={`contact-row-${contact.id}`} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {contact.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {contact.position || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {contact.phone ? (
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: MONO_FONT, fontSize: '0.875rem', mb: 0.5 }}
                          dir="ltr"
                        >
                          {contact.phone}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title={t('contacts.call')}>
                            <IconButton
                              size="small"
                              href={`tel:${contact.phone}`}
                              sx={{
                                p: 0.5,
                                color: 'success.main',
                                '&:hover': { backgroundColor: 'success.50' }
                              }}
                            >
                              <PhoneCallIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('contacts.whatsapp')}>
                            <IconButton
                              size="small"
                              onClick={(e) => openWhatsApp(contact.phone!, e)}
                              sx={{
                                p: 0.5,
                                color: '#25D366',
                                '&:hover': { backgroundColor: '#e8f5e9' }
                              }}
                            >
                              <WhatsAppIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('app.copy')}>
                            <IconButton
                              size="small"
                              onClick={(e) => handleCopy(contact.phone!, e)}
                              sx={{ p: 0.5, opacity: 0.6, '&:hover': { opacity: 1 } }}
                            >
                              <ContentCopyIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {contact.email ? (
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.875rem',
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 200,
                          }}
                          dir="ltr"
                        >
                          {contact.email}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title={t('contacts.sendEmail')}>
                            <IconButton
                              size="small"
                              href={`mailto:${contact.email}`}
                              sx={{
                                p: 0.5,
                                color: 'info.main',
                                '&:hover': { backgroundColor: 'info.50' }
                              }}
                            >
                              <EmailIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('app.copy')}>
                            <IconButton
                              size="small"
                              onClick={(e) => handleCopy(contact.email!, e)}
                              sx={{ p: 0.5, opacity: 0.6, '&:hover': { opacity: 1 } }}
                            >
                              <ContentCopyIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {contact.applies_to_all_sites ? (
                      <Chip label={t('contacts.allSites')} size="small" color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {contact.site_ids?.map((siteId: string) => (
                          <Chip
                            key={siteId}
                            label={sitesMap[siteId] || siteId}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => setEditingContact(contact)}
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
          data-testid="create-contact-button"
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

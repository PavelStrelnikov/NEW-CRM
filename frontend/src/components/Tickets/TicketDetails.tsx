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
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Link,
  IconButton,
  Avatar,
  Tooltip,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ticketsApi } from '@/api/tickets';
import { portalTicketsApi } from '@/api/portalTickets';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { assetsApi } from '@/api/assets';
import { portalAssetsApi } from '@/api/portalAssets';
import { useAuth } from '@/contexts/AuthContext';
import { formatIsraelTime } from '@/utils/timezone';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import HomeRepairServiceIcon from '@mui/icons-material/HomeRepairService';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BuildIcon from '@mui/icons-material/Build';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import RouterIcon from '@mui/icons-material/Router';
import { WorkLogForm } from './WorkLogForm';
import { TicketFilesTab } from './TicketFilesTab';
import { HealthStatusIcon } from '../Assets/HealthStatusIcon';
import { usersApi } from '@/api/users';
import { LineItemForm } from './LineItemForm';
import { TicketForm } from './TicketForm';
import { useToast } from '@/contexts/ToastContext';
import { STATUS_MAP } from '@/constants/statusMap';
import { getChannelLabel } from '@/constants/channelMap';
import { useResponsive } from '@/hooks/useResponsive';
import { copyToClipboard as copyText } from '@/utils/clipboard';

const PRIORITY_COLORS = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
} as const;

const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'] as const;

export const TicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const locale = i18n.language;
  const isRTL = i18n.language === 'he';
  const { isMobile } = useResponsive();
  const { user } = useAuth();

  // Determine if user is portal user
  const isPortalUser = user?.user_type === 'portal';

  // Context-aware navigation base paths
  const basePrefix = location.pathname.startsWith('/portal') ? '/portal' : '/admin';
  const clientsBasePath = `${basePrefix}/clients`;
  const assetsBasePath = `${basePrefix}/assets`;
  const [currentTab, setCurrentTab] = useState(0);
  const [isWorkLogDialogOpen, setIsWorkLogDialogOpen] = useState(false);
  const [isLineItemDialogOpen, setIsLineItemDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingWorkLog, setEditingWorkLog] = useState<any>(null);

  // Quick action menu anchors
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [priorityMenuAnchor, setPriorityMenuAnchor] = useState<null | HTMLElement>(null);
  const [assigneeMenuAnchor, setAssigneeMenuAnchor] = useState<null | HTMLElement>(null);
  const [categoryMenuAnchor, setCategoryMenuAnchor] = useState<null | HTMLElement>(null);

  // Fetch ticket
  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket', id, isPortalUser],
    queryFn: () => isPortalUser ? portalTicketsApi.get(id!) : ticketsApi.getTicket(id!),
    enabled: !!id,
  });

  // Fetch client info
  const { data: client } = useQuery({
    queryKey: ['client', ticket?.client_id, isPortalUser],
    queryFn: () =>
      isPortalUser
        ? portalClientsApi.get(ticket!.client_id)
        : clientsApi.getClient(ticket!.client_id),
    enabled: !!ticket?.client_id,
  });

  // Fetch site info
  const { data: site } = useQuery({
    queryKey: ['site', ticket?.site_id, isPortalUser],
    queryFn: () =>
      isPortalUser
        ? portalClientsApi.getSite(ticket!.site_id)
        : clientsApi.getSite(ticket!.site_id),
    enabled: !!ticket?.site_id,
  });

  // Fetch work logs (activities)
  const { data: workLogs, refetch: refetchWorkLogs } = useQuery({
    queryKey: ['workLogs', id, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser ? portalTicketsApi.listWorkLogs(id!) : ticketsApi.listWorkLogs(id!),
    enabled: !!id,
  });

  // Fetch statuses for quick change
  const { data: statuses } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: () => ticketsApi.listTicketStatuses(),
  });

  // Fetch categories for quick change (admin only - portal users don't have access)
  const { data: categories } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: () => ticketsApi.listTicketCategories(),
    enabled: user?.user_type === 'internal', // Only load for admin users
  });

  // Fetch technicians for quick assignment
  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => usersApi.listInternalUsers({ role: 'technician', is_active: true }),
  });

  // Fetch linked asset if ticket has asset_id
  const { data: linkedAsset, isLoading: isAssetLoading } = useQuery({
    queryKey: ['asset', ticket?.asset_id, isPortalUser],
    queryFn: () =>
      isPortalUser
        ? portalAssetsApi.get(ticket!.asset_id!)
        : assetsApi.getAsset(ticket!.asset_id!),
    enabled: !!ticket?.asset_id,
  });

  // Quick action mutation - all use PATCH /tickets/{id} (internal users only)
  const updateTicketMutation = useMutation({
    mutationFn: (updates: { status_id?: string; priority?: string; assigned_to_internal_user_id?: string | null; category_id?: string | null }) => {
      if (isPortalUser) {
        // Portal users cannot update tickets after creation
        throw new Error('Portal users cannot update tickets');
      }
      return ticketsApi.updateTicket(id!, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      // Invalidate linked asset cache so health status updates
      if (ticket?.asset_id) {
        queryClient.invalidateQueries({ queryKey: ['asset', ticket.asset_id] });
      }
    },
  });

  const handleStatusChange = async (statusId: string) => {
    setStatusMenuAnchor(null);
    try {
      // Find the new status to check if it's closed
      const newStatus = statuses?.find(s => s.id === statusId);
      const isClosingTicket = newStatus?.is_closed_state;

      await updateTicketMutation.mutateAsync({ status_id: statusId });
      showSuccess(t('tickets.statusUpdated'));

      // If closing ticket with linked asset, suggest verification probe
      if (isClosingTicket && ticket?.asset_id && linkedAsset) {
        setTimeout(() => {
          showSuccess(
            locale === 'he'
              ? `קריאה נסגרה בהצלחה. מומלץ לבצע בדיקת אימות (Probe) לציוד "${linkedAsset.label}" כדי לוודא שהבעיה נפתרה.`
              : `Ticket closed successfully. Consider running a verification probe on "${linkedAsset.label}" to confirm the issue is resolved.`,
            { duration: 8000 }
          );
        }, 1500);
      }
    } catch (err: any) {
      showError(err?.response?.data?.detail || t('app.error'));
    }
  };

  const handlePriorityChange = async (priority: string) => {
    setPriorityMenuAnchor(null);
    try {
      await updateTicketMutation.mutateAsync({ priority });
      showSuccess(t('tickets.priorityUpdated'));
    } catch (err: any) {
      showError(err?.response?.data?.detail || t('app.error'));
    }
  };

  const handleAssigneeChange = async (userId: string | null) => {
    setAssigneeMenuAnchor(null);
    try {
      await updateTicketMutation.mutateAsync({ assigned_to_internal_user_id: userId });
      showSuccess(t('tickets.assignmentSuccess'));
    } catch (err: any) {
      showError(err?.response?.data?.detail || t('app.error'));
    }
  };

  const handleCategoryChange = async (categoryId: string | null) => {
    setCategoryMenuAnchor(null);
    try {
      await updateTicketMutation.mutateAsync({ category_id: categoryId });
      showSuccess(t('tickets.categoryUpdated'));
    } catch (err: any) {
      showError(err?.response?.data?.detail || t('app.error'));
    }
  };

  // Helper function to get category label
  const getCategoryLabel = (category_code?: string, category_name?: string): string => {
    if (!category_code) return t('tickets.noCategory');
    // Prefer localized name, fallback to code
    if (category_name) return category_name;
    return category_code;
  };

  // Helper functions
  const getPriorityLabel = (priority?: string): string => {
    if (!priority) return '-';
    const key = `tickets.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
    return t(key);
  };

  const getWorkTypeLabel = (workType: string): string => {
    const labelMap: Record<string, string> = {
      phone: 'tickets.workTypePhone',
      email: 'tickets.workTypeEmail',
      whatsapp: 'tickets.workTypeWhatsapp',
      remote: 'tickets.workTypeRemote',
      onsite: 'tickets.workTypeOnsite',
      travel: 'tickets.workTypeTravel',
      repair_lab: 'tickets.workTypeRepairLab',
      admin: 'tickets.workTypeAdmin',
      other: 'tickets.workTypeOther',
    };
    return t(labelMap[workType] || workType);
  };

  const getWorkTypeIcon = (workType: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      phone: <PhoneIcon />,
      email: <EmailIcon />,
      whatsapp: <WhatsAppIcon />,
      remote: <DesktopWindowsIcon />,
      onsite: <HomeRepairServiceIcon />,
      travel: <DirectionsCarIcon />,
      repair_lab: <BuildIcon />,
      admin: <AdminPanelSettingsIcon />,
      other: <MoreHorizIcon />,
    };
    return iconMap[workType] || <MoreHorizIcon />;
  };

  const formatWorkLogTime = (log: any): string => {
    if (log.end_at) {
      // Mode A: Time range
      return `${formatIsraelTime(log.start_at, 'HH:mm')}–${formatIsraelTime(log.end_at, 'HH:mm')} • ${formatIsraelTime(log.start_at, 'dd/MM/yyyy')}`;
    } else {
      // Mode B: Duration only
      return `${formatIsraelTime(log.start_at, 'dd/MM/yyyy')} • ${log.duration_minutes || 0} ${locale === 'he' ? 'דק׳' : 'min'}`;
    }
  };

  /**
   * Format phone number for WhatsApp link.
   * Converts Israeli format (05x) to international (+972).
   */
  const formatWhatsAppLink = (phone: string): string => {
    if (!phone) return '';
    // Remove non-digits
    const cleaned = phone.replace(/\D/g, '');
    // Israeli numbers: if starts with 0, replace with 972
    const international = cleaned.startsWith('0')
      ? `972${cleaned.slice(1)}`
      : cleaned;
    return `https://wa.me/${international}`;
  };

  // Copy phone to clipboard
  const handleCopy = async (text: string) => {
    const success = await copyText(text);
    if (success) {
      showSuccess(t('assets.copied'));
    } else {
      showError(t('app.copyError'));
    }
  };

  // Get callback contact info - resolves the actual contact to use
  const getCallbackInfo = () => {
    const callbackContact = ticket?.callback_contact;
    const contactPerson = ticket?.contact_person;
    const callbackPhone = ticket?.contact_phone;

    // Primary phone is always the explicit callback phone field
    const phone = callbackPhone || callbackContact?.phone || contactPerson?.phone || '';

    // Name: use callback contact if different from opener, otherwise opener
    const name = callbackContact?.name || contactPerson?.name || '';

    // Determine if callback is same person as opener
    const isSameAsOpener = !callbackContact || callbackContact.id === contactPerson?.id;

    return { phone, name, isSameAsOpener };
  };

  // Show error toast if needed
  React.useEffect(() => {
    if (error) {
      showError(t('app.error') + ': ' + ((error as any)?.message || 'Failed to load ticket'));
    }
  }, [error, showError, t]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ticket) {
    return (
      <Alert severity="error">
        {t('app.error')}: Ticket not found
      </Alert>
    );
  }

  const statusCode = ticket.status?.code;
  const statusConfig = statusCode ? STATUS_MAP[statusCode] : null;
  const statusLabel = statusConfig
    ? (locale === 'he' ? statusConfig.label_he : statusConfig.label_en)
    : (statusCode || '-');

  const callbackInfo = getCallbackInfo();

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
      {/* Top Bar: Back + Edit */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/tickets')}>
          <ArrowBackIcon sx={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
        </IconButton>
        {isMobile ? (
          <IconButton
            color="primary"
            onClick={() => setIsEditDialogOpen(true)}
            sx={{ border: 1, borderColor: 'primary.main' }}
          >
            <EditIcon />
          </IconButton>
        ) : (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setIsEditDialogOpen(true)}
            sx={{ px: 3 }}
          >
            {t('app.edit')}
          </Button>
        )}
      </Box>

      {/* HERO SECTION - Critical Info at a Glance */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Hero Banner - Callback Phone Prominent */}
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Grid container spacing={{ xs: 2, md: 3 }} alignItems="center">
            {/* Left: Phone Number - THE HERO */}
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: 'primary.main',
                  }}
                >
                  <PhoneIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.02em' }}
                  >
                    {t('tickets.callbackPhone')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      component="a"
                      href={`tel:${callbackInfo.phone}`}
                      sx={{
                        fontSize: { xs: '1.5rem', md: '1.75rem' },
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: 'primary.main',
                        textDecoration: 'none',
                        letterSpacing: '0.03em',
                        direction: 'ltr',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {callbackInfo.phone || '—'}
                    </Typography>
                    {callbackInfo.phone && (
                      <Box sx={{ display: 'flex', gap: { xs: 1, sm: 0.5 }, flexWrap: 'wrap' }}>
                        {/* Phone Call Button */}
                        <Tooltip title={t('tickets.callNow')}>
                          <IconButton
                            component="a"
                            href={`tel:${callbackInfo.phone}`}
                            size="small"
                            color="primary"
                            sx={{
                              minWidth: 44,
                              minHeight: 44,
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                              '&:hover': {
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
                              },
                            }}
                          >
                            <PhoneIcon />
                          </IconButton>
                        </Tooltip>

                        {/* WhatsApp Button */}
                        <Tooltip title={t('tickets.whatsapp')}>
                          <IconButton
                            component="a"
                            href={formatWhatsAppLink(callbackInfo.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="small"
                            sx={{
                              minWidth: 44,
                              minHeight: 44,
                              color: '#25D366', // WhatsApp brand green
                              bgcolor: alpha('#25D366', 0.1),
                              '&:hover': {
                                bgcolor: alpha('#25D366', 0.2),
                              },
                            }}
                          >
                            <WhatsAppIcon />
                          </IconButton>
                        </Tooltip>

                        {/* Email Button (if contact has email) */}
                        {(ticket?.callback_contact?.email || ticket?.contact_person?.email) && (
                          <Tooltip title={t('tickets.sendEmail')}>
                            <IconButton
                              component="a"
                              href={`mailto:${ticket?.callback_contact?.email || ticket?.contact_person?.email}`}
                              size="small"
                              color="info"
                              sx={{
                                minWidth: 44,
                                minHeight: 44,
                                bgcolor: (theme) => alpha(theme.palette.info.main, 0.1),
                                '&:hover': {
                                  bgcolor: (theme) => alpha(theme.palette.info.main, 0.2),
                                },
                              }}
                            >
                              <EmailIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* Copy Phone Button */}
                        <Tooltip title={t('tickets.copyPhone')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleCopy(callbackInfo.phone)}
                            sx={{
                              minWidth: 44,
                              minHeight: 44,
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                              '&:hover': {
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
                              },
                            }}
                          >
                            <ContentCopyIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                  {callbackInfo.name && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, fontSize: '0.95rem' }}
                    >
                      <PersonIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }} />
                      {callbackInfo.name}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Vertical Divider */}
            <Grid item sx={{ display: { xs: 'none', md: 'block' } }}>
              <Divider orientation="vertical" flexItem sx={{ height: 80 }} />
            </Grid>

            {/* Right: Client & Site */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {/* Client */}
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    {t('tickets.client')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <BusinessIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    {client ? (
                      <Link
                        component="button"
                        onClick={() => navigate(`${clientsBasePath}/${ticket.client_id}`)}
                        sx={{
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          textAlign: 'start',
                        }}
                      >
                        {client.name}
                      </Link>
                    ) : (
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        {ticket.client_id}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Site */}
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    {t('tickets.site')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <LocationOnIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                      {site?.name || ticket.site_id}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Ticket Header Bar - ID on left, Title prominent */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: (theme) => alpha(theme.palette.divider, 0.5),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {/* Ticket ID - Secondary, on the left (RTL: appears on left side) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              order: isRTL ? 1 : 0,
            }}
          >
            <Typography
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: 'text.secondary',
                bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                letterSpacing: '0.02em',
              }}
            >
              {ticket.ticket_number}
            </Typography>
            <Tooltip title={t('assets.copy')}>
              <IconButton
                size="small"
                onClick={() => handleCopy(ticket.ticket_number)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  },
                }}
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Assignment Status - Clickable Quick Action */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              order: isRTL ? 0 : 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.8rem' }}
            >
              {t('tickets.assignedTo')}:
            </Typography>
            <Tooltip title={t('tickets.clickToReassign')}>
              <Chip
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {ticket.assigned_to_name || t('tickets.unassigned')}
                    <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                  </Box>
                }
                color={ticket.assigned_to_name ? 'primary' : 'warning'}
                variant="outlined"
                size="small"
                clickable
                onClick={(e) => setAssigneeMenuAnchor(e.currentTarget)}
                sx={{
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': {
                    filter: 'brightness(0.9)',
                  },
                }}
              />
            </Tooltip>

            {/* Assignee Menu */}
            <Menu
              anchorEl={assigneeMenuAnchor}
              open={Boolean(assigneeMenuAnchor)}
              onClose={() => setAssigneeMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: isRTL ? 'right' : 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: isRTL ? 'right' : 'left' }}
            >
              {/* Unassign option */}
              <MenuItem
                onClick={() => handleAssigneeChange(null)}
                sx={{ minWidth: 200 }}
              >
                <ListItemIcon>
                  {!ticket.assigned_to_internal_user_id && <CheckIcon color="primary" />}
                </ListItemIcon>
                <ListItemText
                  primary={t('tickets.unassigned')}
                  sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                />
              </MenuItem>
              <Divider />
              {/* Technicians list */}
              {technicians?.items?.map((user) => {
                const isSelected = ticket.assigned_to_internal_user_id === user.id;
                return (
                  <MenuItem
                    key={user.id}
                    onClick={() => handleAssigneeChange(user.id)}
                    selected={isSelected}
                  >
                    <ListItemIcon>
                      {isSelected ? <CheckIcon color="primary" /> : <PersonIcon color="action" />}
                    </ListItemIcon>
                    <ListItemText primary={user.name} />
                  </MenuItem>
                );
              })}
            </Menu>
          </Box>
        </Box>

        {/* Ticket Title & Status Section */}
        <Box sx={{ p: 3 }}>
          {/* Title - Primary, Bold, Clear */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              mb: 2,
              lineHeight: 1.3,
              color: 'text.primary',
            }}
          >
            {ticket.title}
          </Typography>

          {/* Status & Priority Row - Clickable Quick Actions */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            {/* Status Chip - Clickable */}
            <Tooltip title={t('tickets.clickToChangeStatus')}>
              <Chip
                icon={updateTicketMutation.isPending ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  statusConfig?.icon || undefined
                )}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {statusLabel}
                    <KeyboardArrowDownIcon sx={{ fontSize: 18, ml: 0.5 }} />
                  </Box>
                }
                color={statusConfig?.color || 'default'}
                clickable
                onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  '&:hover': {
                    filter: 'brightness(0.9)',
                  },
                }}
              />
            </Tooltip>

            {/* Status Menu */}
            <Menu
              anchorEl={statusMenuAnchor}
              open={Boolean(statusMenuAnchor)}
              onClose={() => setStatusMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: isRTL ? 'right' : 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: isRTL ? 'right' : 'left' }}
            >
              {statuses?.map((status) => {
                const config = STATUS_MAP[status.code];
                const label = locale === 'he' ? (config?.label_he || status.code) : (config?.label_en || status.code);
                const isSelected = ticket.status?.id === status.id;
                return (
                  <MenuItem
                    key={status.id}
                    onClick={() => handleStatusChange(status.id)}
                    selected={isSelected}
                    sx={{ minWidth: 180 }}
                  >
                    <ListItemIcon>
                      {isSelected ? <CheckIcon color="primary" /> : config?.icon || null}
                    </ListItemIcon>
                    <ListItemText primary={label} />
                  </MenuItem>
                );
              })}
            </Menu>

            {/* Priority Chip - Clickable */}
            <Tooltip title={t('tickets.clickToChangePriority')}>
              <Chip
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getPriorityLabel(ticket.priority)}
                    <KeyboardArrowDownIcon sx={{ fontSize: 18, ml: 0.5 }} />
                  </Box>
                }
                color={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS] || 'default'}
                variant="outlined"
                clickable
                onClick={(e) => setPriorityMenuAnchor(e.currentTarget)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  '&:hover': {
                    filter: 'brightness(0.9)',
                  },
                }}
              />
            </Tooltip>

            {/* Priority Menu */}
            <Menu
              anchorEl={priorityMenuAnchor}
              open={Boolean(priorityMenuAnchor)}
              onClose={() => setPriorityMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: isRTL ? 'right' : 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: isRTL ? 'right' : 'left' }}
            >
              {PRIORITY_OPTIONS.map((priority) => {
                const isSelected = ticket.priority === priority;
                return (
                  <MenuItem
                    key={priority}
                    onClick={() => handlePriorityChange(priority)}
                    selected={isSelected}
                    sx={{ minWidth: 150 }}
                  >
                    <ListItemIcon>
                      {isSelected && <CheckIcon color="primary" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={getPriorityLabel(priority)}
                      sx={{
                        '& .MuiTypography-root': {
                          color: priority === 'urgent' ? 'error.main' :
                                 priority === 'high' ? 'warning.main' :
                                 priority === 'normal' ? 'info.main' : 'text.secondary',
                          fontWeight: isSelected ? 600 : 400,
                        },
                      }}
                    />
                  </MenuItem>
                );
              })}
            </Menu>

            {/* Category Chip - Clickable */}
            <Tooltip title={t('tickets.clickToChangeCategory')}>
              <Chip
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getCategoryLabel(ticket.category_code, ticket.category_name)}
                    <KeyboardArrowDownIcon sx={{ fontSize: 18, ml: 0.5 }} />
                  </Box>
                }
                color="secondary"
                variant="outlined"
                clickable
                onClick={(e) => setCategoryMenuAnchor(e.currentTarget)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  '&:hover': {
                    filter: 'brightness(0.9)',
                  },
                }}
              />
            </Tooltip>

            {/* Category Menu */}
            <Menu
              anchorEl={categoryMenuAnchor}
              open={Boolean(categoryMenuAnchor)}
              onClose={() => setCategoryMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: isRTL ? 'right' : 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: isRTL ? 'right' : 'left' }}
            >
              {/* No Category option */}
              <MenuItem
                onClick={() => handleCategoryChange(null)}
                sx={{ minWidth: 200 }}
              >
                <ListItemIcon>
                  {!ticket.category_id && <CheckIcon color="primary" />}
                </ListItemIcon>
                <ListItemText
                  primary={t('tickets.noCategory')}
                  sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                />
              </MenuItem>
              <Divider />
              {categories?.filter(c => c.is_active).map((category) => {
                const isSelected = ticket.category_id === category.id;
                const label = locale === 'he' ? (category.name_he || category.code) : (category.name_en || category.code);
                return (
                  <MenuItem
                    key={category.id}
                    onClick={() => handleCategoryChange(category.id)}
                    selected={isSelected}
                  >
                    <ListItemIcon>
                      {isSelected && <CheckIcon color="primary" />}
                    </ListItemIcon>
                    <ListItemText primary={label} />
                  </MenuItem>
                );
              })}
            </Menu>

            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {t('tickets.createdAt')}: {formatIsraelTime(ticket.created_at)}
            </Typography>
          </Box>

          {/* Problem Description - Always Visible */}
          <Box
            sx={{
              mt: 2,
              p: 2.5,
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
              borderRadius: 1.5,
              border: 1,
              borderColor: (theme) => alpha(theme.palette.divider, 0.5),
            }}
          >
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1, fontSize: '0.9rem', fontWeight: 600 }}
            >
              {t('tickets.problemDetails')}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                whiteSpace: 'pre-wrap',
                fontSize: '1rem',
                lineHeight: 1.6,
              }}
            >
              {ticket.description}
            </Typography>
          </Box>

          {/* Compact Info Row */}
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              gap: 3,
              flexWrap: 'wrap',
              pt: 2,
              borderTop: 1,
              borderColor: (theme) => alpha(theme.palette.divider, 0.5),
            }}
          >
            {/* Source Channel */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                {t('tickets.sourceChannel')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {getChannelLabel(ticket.reported_via, locale)}
              </Typography>
            </Box>

            {/* Opener (only show if different from callback) */}
            {ticket.contact_person?.name && !callbackInfo.isSameAsOpener && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {t('tickets.openedBy')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {ticket.contact_person.name}
                </Typography>
              </Box>
            )}

            {/* Created By (internal) */}
            {ticket.created_by_name && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  {t('tickets.createdBy')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {ticket.created_by_name}
                </Typography>
              </Box>
            )}

            {/* Updated */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                {t('tickets.updatedAt')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatIsraelTime(ticket.updated_at)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Tabs - New order: Activities, Linked Equipment, Line Items, Files, Events */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={currentTab}
          onChange={(_, v) => setCurrentTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
        >
          <Tab label={t('tickets.activities')} />
          <Tab label={t('tickets.linkedAssets')} />
          <Tab label={t('tickets.lineItems')} />
          <Tab label={t('tickets.files')} />
          <Tab label={t('tickets.events')} />
        </Tabs>
      </Box>

      {/* Tab 0: Activities (Work Logs) */}
      {currentTab === 0 && (
        <Box>
          {/* Add Activity button (admin/internal users only) */}
          {!isPortalUser && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => setIsWorkLogDialogOpen(true)}>
                {t('tickets.addActivity')}
              </Button>
            </Box>
          )}
          <Paper sx={{ p: 0, overflow: 'hidden' }}>
            {!workLogs || workLogs.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Typography color="text.secondary">{t('tickets.noActivities')}</Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: isPortalUser ? '200px 220px 1fr' : '200px 220px 1fr 80px',
                  },
                  gap: 0,
                }}
              >
                {workLogs.map((log, idx) => (
                  <React.Fragment key={log.id}>
                    {idx > 0 && (
                      <Divider
                        sx={{
                          gridColumn: { xs: '1', sm: '1 / -1' },
                        }}
                      />
                    )}
                    {/* Column 1: Type */}
                    <Box
                      sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: { xs: 'row', sm: 'row' },
                        alignItems: 'center',
                        gap: 1,
                        gridColumn: { xs: '1', sm: '1' },
                      }}
                    >
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                        {getWorkTypeIcon(log.work_type)}
                      </Avatar>
                      <Typography variant="subtitle2">
                        {getWorkTypeLabel(log.work_type)}
                      </Typography>
                    </Box>

                    {/* Column 2: Time */}
                    <Box
                      sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        gridColumn: { xs: '1', sm: '2' },
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {formatWorkLogTime(log)}
                      </Typography>
                      <Chip
                        icon={<AccessTimeIcon />}
                        label={`${log.duration_minutes || 0} ${locale === 'he' ? 'דק׳' : 'min'}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ width: 'fit-content' }}
                      />
                    </Box>

                    {/* Column 3: Description */}
                    <Box
                      sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        gridColumn: { xs: '1', sm: '3' },
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {log.description}
                      </Typography>
                      {log.actor_display && (
                        <Typography variant="caption" color="text.secondary">
                          {log.actor_display}
                        </Typography>
                      )}
                    </Box>

                    {/* Column 4: Actions (admin/internal users only) */}
                    {!isPortalUser && (
                      <Box
                        sx={{
                          p: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gridColumn: { xs: '1', sm: '4' },
                        }}
                      >
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            setEditingWorkLog(log);
                            setIsWorkLogDialogOpen(true);
                          }}
                          aria-label={t('app.edit')}
                        >
                          <EditIcon />
                        </IconButton>
                      </Box>
                    )}
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Tab 1: Linked Equipment */}
      {currentTab === 1 && (
        <Paper sx={{ p: 0 }}>
          {!ticket.asset_id ? (
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary">
                {t('assets.noServiceTickets')}
              </Typography>
            </Box>
          ) : isAssetLoading ? (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : linkedAsset ? (
            <Box sx={{ p: 3 }}>
              {/* Asset Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                  <RouterIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Link
                    component="button"
                    onClick={() => navigate(`${assetsBasePath}/${linkedAsset.id}`)}
                    sx={{
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600, textAlign: 'start' }}>
                      {linkedAsset.label}
                    </Typography>
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {linkedAsset.asset_type_code || 'Asset'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Asset Details Grid */}
              <Grid container spacing={2}>
                {/* Model */}
                {linkedAsset.model && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary">
                      {t('assets.model')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {linkedAsset.model}
                    </Typography>
                  </Grid>
                )}

                {/* Serial Number */}
                {linkedAsset.serial_number && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary">
                      {t('assets.serialNumber')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                      {linkedAsset.serial_number}
                    </Typography>
                  </Grid>
                )}

                {/* Manufacturer */}
                {linkedAsset.manufacturer && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary">
                      {t('assets.manufacturer')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {linkedAsset.manufacturer}
                    </Typography>
                  </Grid>
                )}

                {/* Status */}
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    {t('assets.status')}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={
                        linkedAsset.status === 'active' ? t('assets.statusActive') :
                        linkedAsset.status === 'in_repair' ? t('assets.statusInRepair') :
                        linkedAsset.status === 'inactive' ? t('assets.statusInactive') :
                        linkedAsset.status
                      }
                      size="small"
                      color={
                        linkedAsset.status === 'active' ? 'success' :
                        linkedAsset.status === 'in_repair' ? 'warning' :
                        'default'
                      }
                    />
                  </Box>
                </Grid>

                {/* Health Status */}
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    {t('health.status')}
                  </Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HealthStatusIcon status={linkedAsset.health_status} size="small" />
                    <Typography variant="body2">
                      {linkedAsset.health_status === 'ok' ? t('health.statusOk') :
                       linkedAsset.health_status === 'warning' ? t('health.statusWarning') :
                       linkedAsset.health_status === 'critical' ? t('health.statusCritical') :
                       t('health.statusUnknown')}
                    </Typography>
                  </Box>
                </Grid>

                {/* Last Probe */}
                {linkedAsset.last_probe_at && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary">
                      {t('assets.lastProbe')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatIsraelTime(linkedAsset.last_probe_at)}
                    </Typography>
                  </Grid>
                )}

                {/* WAN IP */}
                {linkedAsset.wan_public_ip && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary">
                      {t('assets.wanPublicIp')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                      {linkedAsset.wan_public_ip}
                    </Typography>
                  </Grid>
                )}

                {/* LAN IP */}
                {linkedAsset.lan_ip_address && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary">
                      {t('assets.lanIpAddress')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                      {linkedAsset.lan_ip_address}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              {/* Health Issues Alert */}
              {linkedAsset.health_issues && linkedAsset.health_issues.length > 0 && (
                <Alert severity="warning" sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {t('health.issues')}:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {linkedAsset.health_issues.slice(0, 5).map((issue, idx) => (
                      <li key={idx}>
                        <Typography variant="body2">{issue}</Typography>
                      </li>
                    ))}
                  </Box>
                </Alert>
              )}
            </Box>
          ) : (
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary">
                {t('app.error')}: Failed to load asset
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Tab 2: Line Items */}
      {currentTab === 2 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => setIsLineItemDialogOpen(true)}>
              {t('tickets.addLineItem')}
            </Button>
          </Box>
          <Paper>
            <List>
              {!ticket.line_items || ticket.line_items.length === 0 ? (
                <ListItem>
                  <ListItemText primary={t('tickets.noTickets')} />
                </ListItem>
              ) : (
                ticket.line_items.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {idx > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={item.description}
                        secondary={`${item.item_type} - ${item.quantity} ${item.unit} - ${
                          item.chargeable ? 'Chargeable' : 'Not Chargeable'
                        }`}
                      />
                    </ListItem>
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Box>
      )}

      {/* Tab 3: Files */}
      {currentTab === 3 && (
        <TicketFilesTab ticketId={ticket.id} />
      )}

      {/* Tab 4: Events */}
      {currentTab === 4 && (
        <Paper>
          <List>
            {!ticket.events || ticket.events.length === 0 ? (
              <ListItem>
                <ListItemText primary={t('tickets.noEvents')} />
              </ListItem>
            ) : (
              ticket.events.map((event, idx) => (
                <React.Fragment key={event.id}>
                  {idx > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={event.message}
                      secondary={`${event.actor_display} - ${formatIsraelTime(event.created_at)}`}
                    />
                  </ListItem>
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>
      )}

      <TicketForm
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          refetch();
        }}
        ticketId={ticket.id}
        initialData={ticket}
      />

      <WorkLogForm
        open={isWorkLogDialogOpen}
        onClose={() => {
          setIsWorkLogDialogOpen(false);
          setEditingWorkLog(null);
        }}
        onSuccess={() => {
          setIsWorkLogDialogOpen(false);
          setEditingWorkLog(null);
          refetchWorkLogs();
        }}
        ticketId={ticket.id}
        workLogId={editingWorkLog?.id}
        initialData={editingWorkLog}
      />

      <LineItemForm
        open={isLineItemDialogOpen}
        onClose={() => setIsLineItemDialogOpen(false)}
        onSuccess={() => {
          setIsLineItemDialogOpen(false);
          refetch();
        }}
        ticketId={ticket.id}
      />
    </Box>
  );
};

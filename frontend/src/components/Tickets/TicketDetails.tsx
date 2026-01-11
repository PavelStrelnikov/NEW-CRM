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
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Link,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ticketsApi } from '@/api/tickets';
import { clientsApi } from '@/api/clients';
import { format } from 'date-fns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { WorkLogForm } from './WorkLogForm';
import { LineItemForm } from './LineItemForm';
import { useToast } from '@/contexts/ToastContext';

const PRIORITY_COLORS = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
} as const;

export const TicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showError } = useToast();
  const locale = i18n.language;
  const [currentTab, setCurrentTab] = useState(0);
  const [isWorkLogDialogOpen, setIsWorkLogDialogOpen] = useState(false);
  const [isLineItemDialogOpen, setIsLineItemDialogOpen] = useState(false);

  // Fetch ticket
  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketsApi.getTicket(id!),
    enabled: !!id,
  });

  // Fetch ticket statuses
  const { data: statuses } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: () => ticketsApi.listTicketStatuses(),
  });

  // Fetch client info
  const { data: client } = useQuery({
    queryKey: ['client', ticket?.client_id],
    queryFn: () => clientsApi.getClient(ticket!.client_id),
    enabled: !!ticket?.client_id,
  });

  // Fetch site info
  const { data: site } = useQuery({
    queryKey: ['site', ticket?.site_id],
    queryFn: () => clientsApi.getSite(ticket!.site_id),
    enabled: !!ticket?.site_id,
  });

  // Create lookup maps
  const statusMap = useMemo(() => {
    if (!statuses) return new Map();
    return new Map(statuses.map(s => [s.id, s]));
  }, [statuses]);

  // Helper functions
  const getStatusLabel = (statusId: string): string => {
    const status = statusMap.get(statusId);
    if (!status) return statusId;
    return locale === 'he' ? status.name_he : status.name_en;
  };

  const getPriorityLabel = (priority?: string): string => {
    if (!priority) return '-';
    const key = `tickets.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
    return t(key);
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

  return (
    <Box>
      {/* Header with back button */}
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/tickets')}
        >
          {t('app.back')}
        </Button>
      </Box>

      {/* Ticket Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" gutterBottom>
            {ticket.ticket_number}: {ticket.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={getStatusLabel(ticket.status_id)} size="small" />
            {ticket.priority && (
              <Chip
                label={getPriorityLabel(ticket.priority)}
                size="small"
                color={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}
              />
            )}
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.client')}
            </Typography>
            {client ? (
              <Link
                component="button"
                variant="body1"
                onClick={() => navigate(`/clients/${ticket.client_id}`)}
                sx={{ textAlign: 'start' }}
              >
                {client.name}
              </Link>
            ) : (
              <Typography variant="body1">{ticket.client_id}</Typography>
            )}
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.site')}
            </Typography>
            <Typography variant="body1">{site?.name || ticket.site_id}</Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.createdAt')}
            </Typography>
            <Typography variant="body1">
              {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.updatedAt')}
            </Typography>
            <Typography variant="body1">
              {format(new Date(ticket.updated_at), 'dd/MM/yyyy HH:mm')}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label={t('tickets.details')} />
          <Tab label={t('tickets.events')} />
          <Tab label={t('tickets.workLogs')} />
          <Tab label={t('tickets.lineItems')} />
        </Tabs>
      </Box>

      {/* Tab 0: Overview/Details */}
      {currentTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {t('tickets.description')}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {ticket.description}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                {t('tickets.category')}
              </Typography>
              <Typography variant="body1">{ticket.category || '-'}</Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                {t('tickets.sourceChannel')}
              </Typography>
              <Typography variant="body1">{ticket.source_channel}</Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                {t('tickets.contactPhone')}
              </Typography>
              <Typography variant="body1">{ticket.contact_phone}</Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                {t('tickets.contactName')}
              </Typography>
              <Typography variant="body1">{ticket.contact_name || '-'}</Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary">
                {t('tickets.assignedTo')}
              </Typography>
              <Typography variant="body1">
                {ticket.assigned_to_internal_user_id || '-'}
              </Typography>
            </Grid>

            {ticket.closed_at && (
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">
                  {t('tickets.closedAt')}
                </Typography>
                <Typography variant="body1">
                  {format(new Date(ticket.closed_at), 'dd/MM/yyyy HH:mm')}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Tab 1: Events */}
      {currentTab === 1 && (
        <Paper>
          <List>
            {!ticket.events || ticket.events.length === 0 ? (
              <ListItem>
                <ListItemText primary={t('tickets.noTickets')} />
              </ListItem>
            ) : (
              ticket.events.map((event, idx) => (
                <React.Fragment key={event.id}>
                  {idx > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={event.message}
                      secondary={`${event.actor_display} - ${format(
                        new Date(event.created_at),
                        'dd/MM/yyyy HH:mm'
                      )}`}
                    />
                  </ListItem>
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>
      )}

      {/* Tab 2: Work Logs */}
      {currentTab === 2 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => setIsWorkLogDialogOpen(true)}>
              {t('tickets.addWorkLog')}
            </Button>
          </Box>
          <Paper>
            <List>
              {!ticket.work_logs || ticket.work_logs.length === 0 ? (
                <ListItem>
                  <ListItemText primary={t('tickets.noTickets')} />
                </ListItem>
              ) : (
                ticket.work_logs.map((log, idx) => (
                  <React.Fragment key={log.id}>
                    {idx > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={log.description}
                        secondary={`${log.work_type} - ${log.duration_minutes || 0} min - ${
                          log.actor_display
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

      {/* Tab 3: Line Items */}
      {currentTab === 3 && (
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

      <WorkLogForm
        open={isWorkLogDialogOpen}
        onClose={() => setIsWorkLogDialogOpen(false)}
        onSuccess={() => {
          setIsWorkLogDialogOpen(false);
          refetch();
        }}
        ticketId={ticket.id}
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

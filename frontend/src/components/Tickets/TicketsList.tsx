import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  MenuItem,
  Grid,
  Button,
  InputAdornment,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterListOff as ClearFiltersIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ticketsApi } from '@/api/tickets';
import { clientsApi } from '@/api/clients';
import { format } from 'date-fns';

const PRIORITY_COLORS = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
} as const;

export const TicketsList: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  // Fetch tickets
  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketsApi.listTickets({ page: 1, page_size: 100 }),
  });

  // Fetch ticket statuses
  const { data: statuses } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: () => ticketsApi.listTicketStatuses(),
  });

  // Fetch clients for filter dropdown
  const { data: clientsData } = useQuery({
    queryKey: ['clients-filter'],
    queryFn: () => clientsApi.listClients({ page_size: 1000 }),
  });

  // Create lookup maps
  const statusMap = useMemo(() => {
    if (!statuses) return new Map();
    return new Map(statuses.map(s => [s.id, s]));
  }, [statuses]);

  const clientMap = useMemo(() => {
    if (!clientsData?.items) return new Map();
    return new Map(clientsData.items.map(c => [c.id, c]));
  }, [clientsData]);

  // Helper functions
  const getStatusLabel = (statusId: string): string => {
    const status = statusMap.get(statusId);
    if (!status) return statusId;
    return locale === 'he' ? status.name_he : status.name_en;
  };

  const getClientName = (clientId: string): string => {
    return clientMap.get(clientId)?.name || clientId;
  };

  const getPriorityLabel = (priority?: string): string => {
    if (!priority) return '-';
    const key = `tickets.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
    return t(key);
  };

  // Apply filters
  const filteredTickets = useMemo(() => {
    if (!ticketsData?.items) return [];

    return ticketsData.items.filter(ticket => {
      // Search filter (ticket number, title, client name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTicketNumber = ticket.ticket_number.toLowerCase().includes(query);
        const matchesTitle = ticket.title.toLowerCase().includes(query);
        const matchesClient = getClientName(ticket.client_id).toLowerCase().includes(query);

        if (!matchesTicketNumber && !matchesTitle && !matchesClient) {
          return false;
        }
      }

      // Status filter
      if (statusFilter && ticket.status_id !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter && ticket.priority !== priorityFilter) {
        return false;
      }

      // Client filter
      if (clientFilter && ticket.client_id !== clientFilter) {
        return false;
      }

      return true;
    });
  }, [ticketsData, searchQuery, statusFilter, priorityFilter, clientFilter, getClientName]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setClientFilter('');
  };

  const hasActiveFilters = searchQuery || statusFilter || priorityFilter || clientFilter;

  if (ticketsError) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(ticketsError as any).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{t('tickets.title')}</Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('tickets.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              size="small"
              label={t('tickets.status')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">{t('tickets.allStatuses')}</MenuItem>
              {statuses?.map((status) => (
                <MenuItem key={status.id} value={status.id}>
                  {locale === 'he' ? status.name_he : status.name_en}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              size="small"
              label={t('tickets.priority')}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="">{t('tickets.allPriorities')}</MenuItem>
              <MenuItem value="low">{t('tickets.priorityLow')}</MenuItem>
              <MenuItem value="normal">{t('tickets.priorityNormal')}</MenuItem>
              <MenuItem value="high">{t('tickets.priorityHigh')}</MenuItem>
              <MenuItem value="urgent">{t('tickets.priorityUrgent')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              select
              size="small"
              label={t('tickets.client')}
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <MenuItem value="">{t('tickets.allClients')}</MenuItem>
              {clientsData?.items.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ClearFiltersIcon />}
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
            >
              {t('tickets.clearFilters')}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      {ticketsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : filteredTickets.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Box textAlign="center">
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('tickets.noTickets')}
            </Typography>
            {hasActiveFilters && (
              <Button
                variant="outlined"
                startIcon={<ClearFiltersIcon />}
                onClick={handleClearFilters}
                sx={{ mt: 2 }}
              >
                {t('tickets.clearFilters')}
              </Button>
            )}
          </Box>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('tickets.ticketNumber')}</TableCell>
                <TableCell>{t('tickets.titleField')}</TableCell>
                <TableCell>{t('tickets.client')}</TableCell>
                <TableCell>{t('tickets.status')}</TableCell>
                <TableCell>{t('tickets.priority')}</TableCell>
                <TableCell>{t('tickets.createdAt')}</TableCell>
                <TableCell align="center">{t('app.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow key={ticket.id} hover>
                  <TableCell>{ticket.ticket_number}</TableCell>
                  <TableCell>{ticket.title}</TableCell>
                  <TableCell>{getClientName(ticket.client_id)}</TableCell>
                  <TableCell>
                    <Chip label={getStatusLabel(ticket.status_id)} size="small" />
                  </TableCell>
                  <TableCell>
                    {ticket.priority ? (
                      <Chip
                        label={getPriorityLabel(ticket.priority)}
                        size="small"
                        color={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}
                      />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Results summary */}
      {!ticketsLoading && filteredTickets.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {hasActiveFilters
              ? `${filteredTickets.length} / ${ticketsData?.total || 0}`
              : `${ticketsData?.total || 0}`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

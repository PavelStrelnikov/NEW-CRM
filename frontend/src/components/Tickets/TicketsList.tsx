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
  Button,
  InputAdornment,
  FormControlLabel,
  Switch,
  TablePagination,
  TableSortLabel,
  Collapse,
  Stack,
  Tooltip,
  Divider,
  alpha,
  Card,
  CardContent,
  CardActionArea,
  Fab,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterListOff as ClearFiltersIcon,
  ExpandLess as ExpandLessIcon,
  CalendarMonth as CalendarIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ticketsApi } from '@/api/tickets';
import { portalTicketsApi } from '@/api/portalTickets';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay } from 'date-fns';
import { STATUS_MAP } from '@/constants/statusMap';
import { TicketForm } from './TicketForm';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileFilterDrawer } from '@/components/Common/MobileFilterDrawer';

const PRIORITY_COLORS = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
} as const;

// Date preset options
type DatePreset = 'all' | 'today' | 'last2days' | 'last7days' | 'custom';

// Sort configuration
type SortField = 'created_at' | 'ticket_number' | 'priority' | 'status';
type SortOrder = 'asc' | 'desc';

export const TicketsList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const isRTL = locale === 'he';
  const { isMobile } = useResponsive();
  const { user } = useAuth();

  // Determine if we're in portal context
  const isPortalUser = user?.user_type === 'portal';
  const basePath = location.pathname.startsWith('/portal') ? '/portal/tickets' : '/admin/tickets';

  // Determine which API to use based on user type
  const api = isPortalUser ? portalTicketsApi : ticketsApi;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [hideClosed, setHideClosed] = useState(true); // Default: hide closed tickets
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Date range filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination state
  const [page, setPage] = useState(0); // MUI uses 0-based indexing
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Compute date filters based on preset
  const { dateFrom, dateTo } = useMemo(() => {
    const today = startOfDay(new Date());
    switch (datePreset) {
      case 'today':
        return {
          dateFrom: format(today, 'yyyy-MM-dd'),
          dateTo: format(today, 'yyyy-MM-dd'),
        };
      case 'last2days':
        return {
          dateFrom: format(subDays(today, 1), 'yyyy-MM-dd'),
          dateTo: format(today, 'yyyy-MM-dd'),
        };
      case 'last7days':
        return {
          dateFrom: format(subDays(today, 6), 'yyyy-MM-dd'),
          dateTo: format(today, 'yyyy-MM-dd'),
        };
      case 'custom':
        return {
          dateFrom: customDateFrom || undefined,
          dateTo: customDateTo || undefined,
        };
      default:
        return { dateFrom: undefined, dateTo: undefined };
    }
  }, [datePreset, customDateFrom, customDateTo]);

  // Fetch tickets with filters applied server-side
  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError, refetch } = useQuery({
    queryKey: [
      'tickets',
      {
        status: statusFilter,
        priority: priorityFilter,
        client_id: clientFilter,
        q: searchQuery,
        hide_closed: hideClosed,
        date_from: dateFrom,
        date_to: dateTo,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: page + 1, // API uses 1-based indexing
        page_size: rowsPerPage,
      },
    ],
    queryFn: () =>
      isPortalUser
        ? portalTicketsApi.list({
            page: page + 1,
            page_size: rowsPerPage,
            status_id: statusFilter || undefined,
            priority: priorityFilter || undefined,
            site_id: clientFilter || undefined,
            search: searchQuery || undefined,
          })
        : ticketsApi.listTickets({
            page: page + 1,
            page_size: rowsPerPage,
            status_id: statusFilter || undefined,
            priority: priorityFilter || undefined,
            site_id: clientFilter || undefined,
            q: searchQuery || undefined,
          }),
  });

  // Fetch clients for filter dropdown (max page_size is 100 per backend validation)
  const { data: clientsData } = useQuery({
    queryKey: ['clients-filter'],
    queryFn: async () => {
      if (user?.user_type === 'portal') {
        // For portal users, use portal clients API
        const response = await portalClientsApi.list();
        return {
          items: response.items,
          total: response.total,
          page: 1,
          page_size: response.total,
        };
      } else {
        // For admin users, use admin API
        return clientsApi.listClients({ page_size: 100 });
      }
    },
    enabled: !!user, // Only load when user is available
  });

  // Create lookup maps
  const clientMap = useMemo(() => {
    if (!clientsData?.items) return new Map();
    return new Map(clientsData.items.map((c) => [c.id, c]));
  }, [clientsData]);

  // Helper functions
  const getClientName = (clientId: string): string => {
    return clientMap.get(clientId)?.name || clientId;
  };

  const getPriorityLabel = (priority?: string): string => {
    if (!priority) return '-';
    const key = `tickets.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
    return t(key);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setClientFilter('');
    setHideClosed(true);
    setDatePreset('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setPage(0);
  };

  const hasActiveFilters =
    searchQuery || statusFilter || priorityFilter || clientFilter || !hideClosed || datePreset !== 'all';

  // Count active filters for badge
  const activeFilterCount = [
    searchQuery,
    statusFilter,
    priorityFilter,
    clientFilter,
    !hideClosed,
    datePreset !== 'all',
  ].filter(Boolean).length;

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(0); // Reset to first page when sorting changes
  };

  // Handle page change
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle date preset change
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      setShowAdvancedFilters(true);
    }
    setPage(0);
  };

  const tickets = ticketsData?.items || [];
  const totalCount = ticketsData?.total || 0;

  // Pagination component to reuse
  const PaginationComponent = () => (
    <TablePagination
      component="div"
      count={totalCount}
      page={page}
      onPageChange={handleChangePage}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      rowsPerPageOptions={[20, 50, 100]}
      labelRowsPerPage={isMobile ? '' : t('tickets.rowsPerPage')}
      labelDisplayedRows={({ from, to, count }) =>
        `${from}-${to} ${t('tickets.of')} ${count !== -1 ? count : `> ${to}`}`
      }
      sx={{
        borderBottom: 'none',
        '.MuiTablePagination-toolbar': {
          minHeight: isMobile ? 48 : 48,
          px: isMobile ? 0 : 2,
        },
        '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
          direction: isRTL ? 'rtl' : 'ltr',
          fontSize: isMobile ? '0.8rem' : '0.875rem',
        },
        '.MuiTablePagination-select': {
          fontSize: isMobile ? '0.8rem' : '0.875rem',
        },
      }}
    />
  );

  // Mobile Ticket Card
  const TicketCard: React.FC<{ ticket: any }> = ({ ticket }) => {
    const statusConfig = ticket.status_code ? STATUS_MAP[ticket.status_code] : null;
    const statusLabel = statusConfig
      ? locale === 'he'
        ? statusConfig.label_he
        : statusConfig.label_en
      : ticket.status_code || '-';

    return (
      <Card
        elevation={0}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <CardActionArea onClick={() => navigate(`${basePath}/${ticket.id}`)}>
          <CardContent sx={{ p: 2 }}>
            {/* Header: Ticket number + Status */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography
                variant="body2"
                fontFamily="monospace"
                fontWeight={600}
                color="primary.main"
              >
                {ticket.ticket_number}
              </Typography>
              {statusConfig ? (
                <Chip
                  icon={statusConfig.icon}
                  label={statusLabel}
                  size="small"
                  color={statusConfig.color}
                  sx={{ fontWeight: 500, fontSize: '0.7rem', height: 24 }}
                />
              ) : (
                <Chip label={statusLabel} size="small" sx={{ height: 24 }} />
              )}
            </Box>

            {/* Title */}
            <Typography
              variant="body1"
              fontWeight={500}
              sx={{
                mb: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {ticket.title}
            </Typography>

            {/* Info row */}
            <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BusinessIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
                  {getClientName(ticket.client_id)}
                </Typography>
              </Box>
              {ticket.assigned_to_name && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {ticket.assigned_to_name}
                  </Typography>
                </Box>
              )}
            </Stack>

            {/* Footer: Priority + Date */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {ticket.priority ? (
                <Chip
                  label={getPriorityLabel(ticket.priority)}
                  size="small"
                  color={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              ) : (
                <Box />
              )}
              <Typography variant="caption" color="text.secondary">
                {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
              </Typography>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  };

  // Mobile filter content
  const FilterContent = () => (
    <Stack spacing={2}>
      <TextField
        fullWidth
        size="small"
        placeholder={t('tickets.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setPage(0);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        select
        fullWidth
        size="small"
        label={t('tickets.status')}
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(0);
        }}
      >
        <MenuItem value="">{t('tickets.allStatuses')}</MenuItem>
        {Object.entries(STATUS_MAP).map(([code, config]) => (
          <MenuItem key={code} value={code}>
            {locale === 'he' ? config.label_he : config.label_en}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        fullWidth
        size="small"
        label={t('tickets.priority')}
        value={priorityFilter}
        onChange={(e) => {
          setPriorityFilter(e.target.value);
          setPage(0);
        }}
      >
        <MenuItem value="">{t('tickets.allPriorities')}</MenuItem>
        <MenuItem value="low">{t('tickets.priorityLow')}</MenuItem>
        <MenuItem value="normal">{t('tickets.priorityNormal')}</MenuItem>
        <MenuItem value="high">{t('tickets.priorityHigh')}</MenuItem>
        <MenuItem value="urgent">{t('tickets.priorityUrgent')}</MenuItem>
      </TextField>

      <TextField
        select
        fullWidth
        size="small"
        label={t('tickets.client')}
        value={clientFilter}
        onChange={(e) => {
          setClientFilter(e.target.value);
          setPage(0);
        }}
      >
        <MenuItem value="">{t('tickets.allClients')}</MenuItem>
        {clientsData?.items.map((client) => (
          <MenuItem key={client.id} value={client.id}>
            {client.name}
          </MenuItem>
        ))}
      </TextField>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={!hideClosed}
            onChange={(e) => {
              setHideClosed(!e.target.checked);
              setPage(0);
            }}
          />
        }
        label={t('tickets.showClosedTickets')}
      />

      {/* Date presets */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('tickets.dateFilter')}
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Chip
            label={t('tickets.today')}
            size="small"
            variant={datePreset === 'today' ? 'filled' : 'outlined'}
            color={datePreset === 'today' ? 'primary' : 'default'}
            onClick={() => handleDatePresetChange('today')}
          />
          <Chip
            label={t('tickets.last2Days')}
            size="small"
            variant={datePreset === 'last2days' ? 'filled' : 'outlined'}
            color={datePreset === 'last2days' ? 'primary' : 'default'}
            onClick={() => handleDatePresetChange('last2days')}
          />
          <Chip
            label={t('tickets.last7Days')}
            size="small"
            variant={datePreset === 'last7days' ? 'filled' : 'outlined'}
            color={datePreset === 'last7days' ? 'primary' : 'default'}
            onClick={() => handleDatePresetChange('last7days')}
          />
          {datePreset !== 'all' && (
            <Chip
              label="✕"
              size="small"
              variant="outlined"
              onClick={() => handleDatePresetChange('all')}
            />
          )}
        </Stack>
      </Box>
    </Stack>
  );

  if (ticketsError) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(ticketsError as any).message}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          mb: { xs: 2, md: 3 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h4" fontWeight={600} sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
          {t('tickets.title')}
        </Typography>
        {!isMobile && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
            sx={{ px: 3 }}
            data-testid="create-ticket-button"
          >
            {t('tickets.createTicket')}
          </Button>
        )}
      </Box>

      {/* Mobile: Search bar + Filter button */}
      {isMobile && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('tickets.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <IconButton
            onClick={() => setIsFilterDrawerOpen(true)}
            sx={{
              border: 1,
              borderColor: hasActiveFilters ? 'primary.main' : 'divider',
              borderRadius: 1,
              bgcolor: hasActiveFilters ? 'primary.main' : 'transparent',
              color: hasActiveFilters ? 'primary.contrastText' : 'text.primary',
              '&:hover': {
                bgcolor: hasActiveFilters ? 'primary.dark' : 'action.hover',
              },
            }}
          >
            <FilterIcon />
          </IconButton>
        </Box>
      )}

      {/* Desktop Filter Toolbar */}
      {!isMobile && (
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Primary Filter Row */}
          <Box
            sx={{
              p: 2,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
            }}
          >
            {/* Search Field */}
            <TextField
              size="small"
              placeholder={t('tickets.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 220,
                flex: '1 1 220px',
                maxWidth: 300,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* Quick Filters */}
            <TextField
              select
              size="small"
              label={t('tickets.status')}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 140,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                },
              }}
            >
              <MenuItem value="">{t('tickets.allStatuses')}</MenuItem>
              {Object.entries(STATUS_MAP).map(([code, config]) => (
                <MenuItem key={code} value={code}>
                  {locale === 'he' ? config.label_he : config.label_en}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label={t('tickets.priority')}
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 130,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                },
              }}
            >
              <MenuItem value="">{t('tickets.allPriorities')}</MenuItem>
              <MenuItem value="low">{t('tickets.priorityLow')}</MenuItem>
              <MenuItem value="normal">{t('tickets.priorityNormal')}</MenuItem>
              <MenuItem value="high">{t('tickets.priorityHigh')}</MenuItem>
              <MenuItem value="urgent">{t('tickets.priorityUrgent')}</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label={t('tickets.client')}
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 180,
                maxWidth: 220,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                },
              }}
            >
              <MenuItem value="">{t('tickets.allClients')}</MenuItem>
              {clientsData?.items.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.name}
                </MenuItem>
              ))}
            </TextField>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* Date Quick Filters */}
            <Stack direction="row" spacing={0.5}>
              <Chip
                icon={<CalendarIcon fontSize="small" />}
                label={t('tickets.today')}
                size="small"
                variant={datePreset === 'today' ? 'filled' : 'outlined'}
                color={datePreset === 'today' ? 'primary' : 'default'}
                onClick={() => handleDatePresetChange('today')}
                sx={{ fontWeight: datePreset === 'today' ? 600 : 400 }}
              />
              <Chip
                label={t('tickets.last2Days')}
                size="small"
                variant={datePreset === 'last2days' ? 'filled' : 'outlined'}
                color={datePreset === 'last2days' ? 'primary' : 'default'}
                onClick={() => handleDatePresetChange('last2days')}
                sx={{ fontWeight: datePreset === 'last2days' ? 600 : 400 }}
              />
              <Chip
                label={t('tickets.last7Days')}
                size="small"
                variant={datePreset === 'last7days' ? 'filled' : 'outlined'}
                color={datePreset === 'last7days' ? 'primary' : 'default'}
                onClick={() => handleDatePresetChange('last7days')}
                sx={{ fontWeight: datePreset === 'last7days' ? 600 : 400 }}
              />
              {datePreset !== 'all' && (
                <Chip
                  label="✕"
                  size="small"
                  variant="outlined"
                  onClick={() => handleDatePresetChange('all')}
                  sx={{ minWidth: 32 }}
                />
              )}
            </Stack>

            {/* Spacer */}
            <Box sx={{ flex: '1 1 auto' }} />

            {/* Right side controls */}
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={!hideClosed}
                    onChange={(e) => {
                      setHideClosed(!e.target.checked);
                      setPage(0);
                    }}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {t('tickets.showClosedTickets')}
                  </Typography>
                }
                sx={{ mr: 1, ml: 0 }}
              />

              <Tooltip title={t('tickets.advancedFilters')}>
                <IconButton
                  size="small"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  color={showAdvancedFilters ? 'primary' : 'default'}
                  sx={{
                    border: 1,
                    borderColor: showAdvancedFilters ? 'primary.main' : 'divider',
                    borderRadius: 1,
                  }}
                >
                  {showAdvancedFilters ? <ExpandLessIcon /> : <FilterIcon />}
                </IconButton>
              </Tooltip>

              {hasActiveFilters && (
                <Tooltip title={t('tickets.clearFilters')}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleClearFilters}
                    startIcon={<ClearFiltersIcon />}
                    sx={{ minWidth: 'auto', px: 1.5 }}
                  >
                    {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </Button>
                </Tooltip>
              )}
            </Stack>
          </Box>

          {/* Advanced Filters (Collapsible) */}
          <Collapse in={showAdvancedFilters}>
            <Box
              sx={{
                p: 2,
                pt: 0,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
              }}
            >
              <Box sx={{ pt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mb: 1.5 }}>
                  <CalendarIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  {t('tickets.customRange')}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                  <TextField
                    size="small"
                    type="date"
                    label={t('tickets.dateFrom')}
                    value={customDateFrom}
                    onChange={(e) => {
                      setCustomDateFrom(e.target.value);
                      setDatePreset('custom');
                      setPage(0);
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      width: 180,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'background.paper',
                      },
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                  <TextField
                    size="small"
                    type="date"
                    label={t('tickets.dateTo')}
                    value={customDateTo}
                    onChange={(e) => {
                      setCustomDateTo(e.target.value);
                      setDatePreset('custom');
                      setPage(0);
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      width: 180,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'background.paper',
                      },
                    }}
                  />
                  {(customDateFrom || customDateTo) && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        setCustomDateFrom('');
                        setCustomDateTo('');
                        setDatePreset('all');
                      }}
                    >
                      {t('app.clear')}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Content Section */}
      {ticketsLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : tickets.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('tickets.noTickets')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {hasActiveFilters
              ? t('tickets.noTicketsWithFilters')
              : t('tickets.noTicketsYet')}
          </Typography>
          {hasActiveFilters && (
            <Button
              variant="outlined"
              startIcon={<ClearFiltersIcon />}
              onClick={handleClearFilters}
            >
              {t('tickets.clearFilters')}
            </Button>
          )}
        </Paper>
      ) : isMobile ? (
        /* Mobile: Card view */
        <>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </Stack>

          {/* Mobile pagination */}
          <Paper
            elevation={0}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              mb: 10, // Space for FAB
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {t('tickets.totalTickets', { total: totalCount })}
              </Typography>
              <PaginationComponent />
            </Box>
          </Paper>
        </>
      ) : (
        /* Desktop: Table view */
        <Paper
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Table with Sticky Header */}
          <TableContainer
            sx={{
              maxHeight: 'calc(100vh - 380px)',
              minHeight: 400,
            }}
          >
            <Table stickyHeader size="medium">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    <TableSortLabel
                      active={sortBy === 'ticket_number'}
                      direction={sortBy === 'ticket_number' ? sortOrder : 'asc'}
                      onClick={() => handleSort('ticket_number')}
                    >
                      {t('tickets.ticketNumber')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('tickets.titleField')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('tickets.client')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    <TableSortLabel
                      active={sortBy === 'status'}
                      direction={sortBy === 'status' ? sortOrder : 'asc'}
                      onClick={() => handleSort('status')}
                    >
                      {t('tickets.status')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    <TableSortLabel
                      active={sortBy === 'priority'}
                      direction={sortBy === 'priority' ? sortOrder : 'asc'}
                      onClick={() => handleSort('priority')}
                    >
                      {t('tickets.priority')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('tickets.assignedTo')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    <TableSortLabel
                      active={sortBy === 'created_at'}
                      direction={sortBy === 'created_at' ? sortOrder : 'asc'}
                      onClick={() => handleSort('created_at')}
                    >
                      {t('tickets.createdAt')}
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket, index) => {
                  const statusConfig = ticket.status_code ? STATUS_MAP[ticket.status_code] : null;
                  const statusLabel = statusConfig
                    ? locale === 'he'
                      ? statusConfig.label_he
                      : statusConfig.label_en
                    : ticket.status_code || '-';

                  return (
                    <TableRow
                      key={ticket.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        bgcolor: index % 2 === 0 ? 'transparent' : (theme) => alpha(theme.palette.grey[500], 0.03),
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                      onClick={() => navigate(`${basePath}/${ticket.id}`)}
                    >
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          fontWeight={500}
                          color="primary.main"
                        >
                          {ticket.ticket_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ticket.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {getClientName(ticket.client_id)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {statusConfig ? (
                          <Chip
                            icon={statusConfig.icon}
                            label={statusLabel}
                            size="small"
                            color={statusConfig.color}
                            sx={{ fontWeight: 500 }}
                          />
                        ) : (
                          <Chip label={statusLabel} size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.priority ? (
                          <Chip
                            label={getPriorityLabel(ticket.priority)}
                            size="small"
                            color={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.assigned_to_name ? (
                          <Chip
                            label={ticket.assigned_to_name}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ) : (
                          <Typography
                            variant="body2"
                            color="warning.main"
                            sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}
                          >
                            {t('tickets.awaitingAssignment')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Bottom Pagination */}
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t('tickets.totalTickets', { total: totalCount })}
            </Typography>
            <PaginationComponent />
          </Box>
        </Paper>
      )}

      {/* Mobile FAB for create */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => setIsCreateDialogOpen(true)}
          data-testid="create-ticket-button"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        open={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onReset={handleClearFilters}
        showReset={!!hasActiveFilters}
      >
        <FilterContent />
      </MobileFilterDrawer>

      <TicketForm
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

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Button,
  FormControlLabel,
  Switch,
  Tooltip,
  TableSortLabel,
  TablePagination,
  InputAdornment,
  Divider,
  alpha,
  Card,
  CardContent,
  CardActionArea,
  Stack,
  Chip,
  IconButton,
  Fab,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterListOff as ClearFiltersIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { ClientForm } from './ClientForm';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileFilterDrawer } from '@/components/Common/MobileFilterDrawer';
import { useAuth } from '@/contexts/AuthContext';

export const ClientsList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === 'he';
  const { isMobile } = useResponsive();

  // Determine if we're in portal context
  const isPortalUser = user?.user_type === 'portal';
  const basePath = location.pathname.startsWith('/portal') ? '/portal/clients' : '/admin/clients';

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showInactive, setShowInactive] = useState(searchParams.get('include_inactive') === '1');
  const [sort, setSort] = useState(searchParams.get('sort') || 'name');
  const [order, setOrder] = useState<'asc' | 'desc'>((searchParams.get('order') as 'asc' | 'desc') || 'asc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) - 1); // MUI uses 0-based
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  useEffect(() => {
    // Don't update search params for portal users (simpler UI)
    if (isPortalUser) return;
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (showInactive) params.include_inactive = '1';
    if (sort !== 'name') params.sort = sort;
    if (order !== 'asc') params.order = order;
    if (page !== 0) params.page = (page + 1).toString();
    setSearchParams(params);
  }, [searchQuery, showInactive, sort, order, page, setSearchParams, isPortalUser]);

  // Use portal API for portal users, admin API for internal users
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', isPortalUser ? 'portal' : 'admin', searchQuery, showInactive, sort, order, page, rowsPerPage],
    queryFn: async () => {
      if (isPortalUser) {
        // Portal API returns simpler response
        const response = await portalClientsApi.list();
        // Filter by search if needed (client-side for portal)
        let items = response.items;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          items = items.filter(c => c.name.toLowerCase().includes(q));
        }
        return { items, total: items.length };
      } else {
        return clientsApi.listClients({
          q: searchQuery,
          include_inactive: showInactive,
          sort,
          order,
          page: page + 1,
          page_size: rowsPerPage
        });
      }
    },
  });

  const handleSort = (field: string) => {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setOrder('asc');
    }
    setPage(0);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setShowInactive(false);
    setPage(0);
  };

  const hasActiveFilters = searchQuery || showInactive;

  // Count active filters for badge
  const activeFilterCount = [searchQuery, showInactive].filter(Boolean).length;

  const totalCount = data?.total || 0;
  const clients = data?.items || [];

  // Pagination component - Enhanced for professional look
  const PaginationComponent = () => (
    <TablePagination
      component="div"
      count={totalCount}
      page={page}
      onPageChange={handleChangePage}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={handleChangeRowsPerPage}
      rowsPerPageOptions={[25, 50, 100]}
      labelRowsPerPage={isMobile ? '' : t('tickets.rowsPerPage')}
      labelDisplayedRows={({ from, to, count }) =>
        `${from}-${to} ${t('tickets.of')} ${count !== -1 ? count : `> ${to}`}`
      }
      sx={{
        borderBottom: 'none',
        '.MuiTablePagination-toolbar': {
          minHeight: isMobile ? 48 : 56,
          px: isMobile ? 1 : 2,
        },
        '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
          direction: isRTL ? 'rtl' : 'ltr',
          fontSize: isMobile ? '0.8rem' : '0.9rem',
        },
        '.MuiTablePagination-select': {
          fontSize: isMobile ? '0.8rem' : '0.9rem',
        },
      }}
    />
  );

  // Mobile Card component for client
  const ClientCard: React.FC<{ client: any }> = ({ client }) => (
    <Card
      elevation={0}
      data-testid={`client-card-${client.id}`}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        ...(!client.is_active && { opacity: 0.6 }),
      }}
    >
      <CardActionArea onClick={() => navigate(`${basePath}/${client.id}`)}>
        <CardContent sx={{ p: 2 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            color="primary.main"
            sx={{ mb: 1 }}
          >
            {client.name}
          </Typography>

          <Stack spacing={0.5}>
            {client.main_phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', color: 'text.primary' }}
                >
                  {client.main_phone}
                </Typography>
              </Box>
            )}
            {client.main_email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {client.main_email}
                </Typography>
              </Box>
            )}
          </Stack>

          {client.tax_id && (
            <Chip
              label={client.tax_id}
              size="small"
              variant="outlined"
              sx={{ mt: 1.5, fontSize: '0.75rem', fontFamily: 'monospace' }}
            />
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );

  // Mobile filter content
  const FilterContent = () => (
    <Stack spacing={2}>
      <TextField
        fullWidth
        placeholder={t('clients.searchPlaceholderFull')}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setPage(0);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      <FormControlLabel
        control={
          <Switch
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(0);
            }}
          />
        }
        label={t('clients.showInactive')}
      />
    </Stack>
  );

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
      {/* Page Header */}
      <Box
        sx={{
          mb: { xs: 2, md: 4 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography
          variant="h4"
          fontWeight={700}
          sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}
        >
          {t('clients.title')}
        </Typography>
        {/* Desktop: Full button, Mobile: hidden (FAB instead) - Only for admin users */}
        {!isMobile && !isPortalUser && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
            sx={{ px: 4, py: 1.25, fontSize: '0.95rem' }}
          >
            {t('clients.create')}
          </Button>
        )}
      </Box>

      {/* Filter Toolbar - Desktop */}
      {!isMobile && (
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
          <Box
            sx={{
              p: 2.5,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2.5,
              alignItems: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
            }}
          >
            {/* Search Field - Larger for professional feel */}
            <TextField
              placeholder={t('clients.searchPlaceholderFull')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 350,
                flex: '1 1 350px',
                maxWidth: 500,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                  fontSize: '1rem',
                  '& input': {
                    py: 1.5,
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" sx={{ fontSize: 24 }} />
                  </InputAdornment>
                ),
              }}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 1.5 }} />

            {/* Show Inactive Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={showInactive}
                  onChange={(e) => {
                    setShowInactive(e.target.checked);
                    setPage(0);
                  }}
                />
              }
              label={
                <Typography variant="body1" color="text.secondary" noWrap>
                  {t('clients.showInactive')}
                </Typography>
              }
              sx={{ mr: 1, ml: 0 }}
            />

            {/* Spacer */}
            <Box sx={{ flex: '1 1 auto' }} />

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Tooltip title={t('tickets.clearFilters')}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleClearFilters}
                  startIcon={<ClearFiltersIcon />}
                  sx={{ minWidth: 'auto', px: 2, py: 1 }}
                >
                  {activeFilterCount > 0 && `(${activeFilterCount})`}
                </Button>
              </Tooltip>
            )}
          </Box>
        </Paper>
      )}

      {/* Mobile: Search bar + Filter button */}
      {isMobile && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('clients.searchPlaceholderFull')}
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
            <FilterListIcon />
          </IconButton>
        </Box>
      )}

      {/* Content Section */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : clients.length === 0 ? (
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
            {t('clients.noClients')}
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
        </Paper>
      ) : isMobile ? (
        /* Mobile: Card view */
        <>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
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
                {t('clients.totalClients', { total: totalCount })}
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
              maxHeight: 'calc(100vh - 360px)',
              minHeight: 450,
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {/* Client Name - Primary column, gets most space */}
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                      py: 2,
                      width: '40%',
                    }}
                  >
                    <TableSortLabel
                      active={sort === 'name'}
                      direction={sort === 'name' ? order : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      {t('clients.name')}
                    </TableSortLabel>
                  </TableCell>
                  {/* Phone */}
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                      py: 2,
                      width: '20%',
                    }}
                  >
                    <TableSortLabel
                      active={sort === 'main_phone'}
                      direction={sort === 'main_phone' ? order : 'asc'}
                      onClick={() => handleSort('main_phone')}
                    >
                      {t('clients.phone')}
                    </TableSortLabel>
                  </TableCell>
                  {/* Email */}
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                      py: 2,
                      width: '25%',
                    }}
                  >
                    {t('clients.email')}
                  </TableCell>
                  {/* Tax ID */}
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                      py: 2,
                      width: '15%',
                    }}
                  >
                    <TableSortLabel
                      active={sort === 'tax_id'}
                      direction={sort === 'tax_id' ? order : 'asc'}
                      onClick={() => handleSort('tax_id')}
                    >
                      {t('clients.taxId')}
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client, index) => (
                  <TableRow
                    key={client.id}
                    data-testid={`client-row-${client.id}`}
                    hover
                    sx={{
                      cursor: 'pointer',
                      // Enhanced zebra striping
                      bgcolor: index % 2 === 0
                        ? 'transparent'
                        : (theme) => alpha(theme.palette.grey[500], 0.04),
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                      },
                      // Subtle bottom border for row separation
                      '& td': {
                        borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      },
                      // Visual indicator for inactive clients
                      ...(!client.is_active && {
                        opacity: 0.5,
                      }),
                    }}
                    onClick={() => navigate(`${basePath}/${client.id}`)}
                  >
                    {/* Client Name - Bold and prominent */}
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography
                        sx={{
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: 'primary.main',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {client.name}
                      </Typography>
                    </TableCell>
                    {/* Phone */}
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography
                        sx={{
                          fontSize: '0.95rem',
                          fontFamily: 'monospace',
                          color: 'text.primary',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {client.main_phone || '—'}
                      </Typography>
                    </TableCell>
                    {/* Email */}
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography
                        sx={{
                          fontSize: '0.95rem',
                          color: 'text.secondary',
                        }}
                      >
                        {client.main_email || '—'}
                      </Typography>
                    </TableCell>
                    {/* Tax ID */}
                    <TableCell sx={{ py: 2.5 }}>
                      <Typography
                        sx={{
                          fontSize: '0.95rem',
                          color: 'text.secondary',
                          fontFamily: 'monospace',
                        }}
                      >
                        {client.tax_id || '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Bottom Pagination - More prominent */}
          <Box
            sx={{
              px: 3,
              py: 1.5,
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.95rem',
                color: 'text.secondary',
                fontWeight: 600,
              }}
            >
              {t('clients.totalClients', { total: totalCount })}
            </Typography>
            <PaginationComponent />
          </Box>
        </Paper>
      )}

      {/* Mobile FAB for create - Only for admin users */}
      {isMobile && !isPortalUser && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => setIsCreateDialogOpen(true)}
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

import React, { useState, useMemo, useEffect } from 'react';
import { logger } from '@/utils/logger';
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
  Chip,
  CircularProgress,
  Alert,
  MenuItem,
  Button,
  InputAdornment,
  TablePagination,
  Tooltip,
  Divider,
  alpha,
  Card,
  CardContent,
  CardActionArea,
  Stack,
  IconButton,
  Fab,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterListOff as ClearFiltersIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Router as RouterIconMui,
  Wifi as WifiIconMui,
  Hub as HubIconMui,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { assetsApi } from '@/api/assets';
import { portalAssetsApi } from '@/api/portalAssets';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { useAuth } from '@/contexts/AuthContext';
import { AssetForm } from './AssetForm';
import { HealthStatusIcon } from './HealthStatusIcon';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileFilterDrawer } from '@/components/Common/MobileFilterDrawer';
import type { Site, HealthStatus } from '@/types';

export const AssetsList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const isRTL = locale === 'he';
  const { user } = useAuth();

  // Determine if portal user and set base path for navigation
  const isPortalUser = user?.user_type === 'portal';
  const basePath = location.pathname.startsWith('/portal') ? '/portal/assets' : '/admin/assets';
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();

  // Determine which API to use based on user type
  const api = user?.user_type === 'portal' ? portalAssetsApi : assetsApi;

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Check if user can create assets (admin or technician)
  const canCreateAsset = user?.role === 'admin' || user?.role === 'technician';

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Fetch assets (max page_size is 100 per backend validation)
  const { data: assetsData, isLoading, error } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.list({ page_size: 100 }),
  });

  // Fetch asset types - use portal API for portal users
  const { data: assetTypes } = useQuery({
    queryKey: ['asset-types'],
    queryFn: () => user?.user_type === 'portal' ? portalAssetsApi.getAssetTypes() : assetsApi.listAssetTypes(),
  });

  // Fetch clients for filter - use portal API for portal users
  const { data: clientsData } = useQuery({
    queryKey: ['clients-filter'],
    queryFn: () => user?.user_type === 'portal' ? portalClientsApi.list() : clientsApi.listClients({ page_size: 100 }),
  });

  // State to store all sites from all clients
  const [allSites, setAllSites] = useState<Site[]>([]);

  // Fetch sites for all clients when clients data is available
  useEffect(() => {
    const fetchAllSites = async () => {
      if (!clientsData?.items) return;

      try {
        // Use portal or admin API based on user type
        const clientsApiToUse = user?.user_type === 'portal' ? portalClientsApi : clientsApi;
        const sitesPromises = clientsData.items.map(client =>
          clientsApiToUse.listSites(client.id).catch(() => ({ items: [], total: 0 }))
        );
        const sitesResponses = await Promise.all(sitesPromises);
        const sites = sitesResponses.flatMap(response => response.items);
        setAllSites(sites);
      } catch (error) {
        logger.error('Failed to fetch sites:', error);
      }
    };

    fetchAllSites();
  }, [clientsData, user]);

  // Create lookup maps
  const assetTypeMap = useMemo(() => {
    if (!assetTypes) return new Map();
    return new Map(assetTypes.map(t => [t.code, t]));
  }, [assetTypes]);

  const clientMap = useMemo(() => {
    if (!clientsData?.items) return new Map();
    return new Map(clientsData.items.map(c => [c.id, c]));
  }, [clientsData]);

  const siteMap = useMemo(() => {
    return new Map(allSites.map(s => [s.id, s]));
  }, [allSites]);

  // Get sites for selected client (for filter dropdown)
  const sitesForSelectedClient = useMemo(() => {
    if (!clientFilter) return allSites;
    return allSites.filter(s => s.client_id === clientFilter);
  }, [allSites, clientFilter]);

  // Helper functions
  const getAssetTypeName = (code: string): string => {
    const type = assetTypeMap.get(code);
    if (!type) return code;
    return locale === 'he' ? (type.name_he || code) : (type.name_en || code);
  };

  const getClientName = (clientId: string): string => {
    return clientMap.get(clientId)?.name || clientId;
  };

  const getSiteName = (siteId: string): string => {
    return siteMap.get(siteId)?.name || '—';
  };

  // Apply filters
  const filteredAssets = useMemo(() => {
    if (!assetsData?.items) return [];

    return assetsData.items.filter(asset => {
      // Search filter (label, serial number, model only)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesLabel = asset.label.toLowerCase().includes(query);
        const matchesSerial = asset.serial_number?.toLowerCase().includes(query);
        const matchesModel = asset.model?.toLowerCase().includes(query);

        if (!matchesLabel && !matchesSerial && !matchesModel) {
          return false;
        }
      }

      // Type filter
      if (typeFilter && asset.asset_type_code !== typeFilter) {
        return false;
      }

      // Client filter
      if (clientFilter && asset.client_id !== clientFilter) {
        return false;
      }

      // Site filter
      if (siteFilter && asset.site_id !== siteFilter) {
        return false;
      }

      return true;
    });
  }, [assetsData, searchQuery, typeFilter, clientFilter, siteFilter]);

  // Paginate filtered results
  const paginatedAssets = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAssets.slice(start, start + rowsPerPage);
  }, [filteredAssets, page, rowsPerPage]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setTypeFilter('');
    setClientFilter('');
    setSiteFilter('');
    setPage(0);
  };

  const hasActiveFilters = searchQuery || typeFilter || clientFilter || siteFilter;

  // Count active filters for badge
  const activeFilterCount = [searchQuery, typeFilter, clientFilter, siteFilter].filter(Boolean).length;

  const handleFormSuccess = () => {
    setFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ['assets'] });
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const totalCount = filteredAssets.length;

  // Pagination component
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

  // Mobile Asset Card
  const AssetCard: React.FC<{ asset: any }> = ({ asset }) => (
    <Card
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <CardActionArea onClick={() => navigate(`${basePath}/${asset.id}`, { state: { from: location.pathname + location.search } })}>
        <CardContent sx={{ p: 2 }}>
          {/* Header: Label + Health status */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} color="primary.main">
              {asset.label}
            </Typography>
            {['ROUTER', 'ACCESS_POINT', 'SWITCH'].includes(asset.asset_type_code) ? (
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: '50%',
                bgcolor: 'rgba(25, 118, 210, 0.08)',
              }}>
                {asset.asset_type_code === 'ROUTER' ? (
                  <RouterIconMui sx={{ fontSize: 18, color: 'primary.main' }} />
                ) : asset.asset_type_code === 'ACCESS_POINT' ? (
                  <WifiIconMui sx={{ fontSize: 18, color: 'primary.main' }} />
                ) : (
                  <HubIconMui sx={{ fontSize: 18, color: 'primary.main' }} />
                )}
              </Box>
            ) : (
              <HealthStatusIcon
                status={asset.health_status as HealthStatus || 'unknown'}
                issues={asset.health_issues}
                size="small"
              />
            )}
          </Box>

          {/* Type + Model */}
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Chip
              label={getAssetTypeName(asset.asset_type_code)}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
            {asset.model && (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                {asset.model}
              </Typography>
            )}
          </Stack>

          {/* Client + Site */}
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BusinessIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {getClientName(asset.client_id)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {getSiteName(asset.site_id)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  // Mobile filter content
  const FilterContent = () => (
    <Stack spacing={2}>
      <TextField
        fullWidth
        size="small"
        placeholder={t('assets.searchPlaceholder')}
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
        label={t('assets.type')}
        value={typeFilter}
        onChange={(e) => {
          setTypeFilter(e.target.value);
          setPage(0);
        }}
      >
        <MenuItem value="">{t('assets.allTypes')}</MenuItem>
        {assetTypes?.map((type) => (
          <MenuItem key={type.code} value={type.code}>
            {locale === 'he' ? (type.name_he || type.code) : (type.name_en || type.code)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        fullWidth
        size="small"
        label={t('clients.title')}
        value={clientFilter}
        onChange={(e) => {
          setClientFilter(e.target.value);
          setSiteFilter('');
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

      <TextField
        select
        fullWidth
        size="small"
        label={t('sites.title')}
        value={siteFilter}
        onChange={(e) => {
          setSiteFilter(e.target.value);
          setPage(0);
        }}
      >
        <MenuItem value="">{t('sites.allSites')}</MenuItem>
        {sitesForSelectedClient.map((site) => (
          <MenuItem key={site.id} value={site.id}>
            {site.name}
          </MenuItem>
        ))}
      </TextField>
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
          {t('assets.title')}
        </Typography>
        {canCreateAsset && !isMobile && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
            sx={{ px: 3 }}
          >
            {t('assets.createAsset')}
          </Button>
        )}
      </Box>

      {/* Mobile: Search bar + Filter button */}
      {isMobile && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={t('assets.searchPlaceholder')}
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
              placeholder={t('assets.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 240,
                flex: '1 1 240px',
                maxWidth: 320,
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

            {/* Type Filter */}
            <TextField
              select
              size="small"
              label={t('assets.type')}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 140,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                },
              }}
            >
              <MenuItem value="">{t('assets.allTypes')}</MenuItem>
              {assetTypes?.map((type) => (
                <MenuItem key={type.code} value={type.code}>
                  {locale === 'he' ? (type.name_he || type.code) : (type.name_en || type.code)}
                </MenuItem>
              ))}
            </TextField>

            {/* Client Filter */}
            <TextField
              select
              size="small"
              label={t('clients.title')}
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setSiteFilter(''); // Reset site when client changes
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

            {/* Site Filter */}
            <TextField
              select
              size="small"
              label={t('sites.title')}
              value={siteFilter}
              onChange={(e) => {
                setSiteFilter(e.target.value);
                setPage(0);
              }}
              sx={{
                minWidth: 150,
                maxWidth: 200,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'background.paper',
                },
              }}
            >
              <MenuItem value="">{t('sites.allSites')}</MenuItem>
              {sitesForSelectedClient.map((site) => (
                <MenuItem key={site.id} value={site.id}>
                  {site.name}
                </MenuItem>
              ))}
            </TextField>

            {/* Spacer */}
            <Box sx={{ flex: '1 1 auto' }} />

            {/* Clear Filters */}
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
          </Box>
        </Paper>
      )}

      {/* Content Section */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : paginatedAssets.length === 0 ? (
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
            {t('assets.noAssets')}
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
            {paginatedAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
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
                {t('assets.totalAssets', { total: totalCount })}
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
              maxHeight: 'calc(100vh - 340px)',
              minHeight: 400,
            }}
          >
            <Table stickyHeader size="medium">
              <TableHead>
                <TableRow>
                  {/* Health Status Column */}
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                      width: 60,
                      textAlign: 'center',
                    }}
                  >
                    {t('health.status')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('assets.label')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('assets.type')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('assets.model')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('clients.title')}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 600,
                      bgcolor: 'background.paper',
                      borderBottom: 2,
                      borderColor: 'primary.main',
                    }}
                  >
                    {t('sites.title')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedAssets.map((asset, index) => (
                  <TableRow
                    key={asset.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      bgcolor: index % 2 === 0 ? 'transparent' : (theme) => alpha(theme.palette.grey[500], 0.03),
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                    onClick={() => navigate(`${basePath}/${asset.id}`, { state: { from: location.pathname + location.search } })}
                  >
                    {/* Health Status Cell */}
                    <TableCell sx={{ textAlign: 'center' }}>
                      {['ROUTER', 'ACCESS_POINT', 'SWITCH'].includes(asset.asset_type_code) ? (
                        <Box sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          bgcolor: 'rgba(25, 118, 210, 0.08)',
                        }}>
                          {asset.asset_type_code === 'ROUTER' ? (
                            <RouterIconMui sx={{ fontSize: 18, color: 'primary.main' }} />
                          ) : asset.asset_type_code === 'ACCESS_POINT' ? (
                            <WifiIconMui sx={{ fontSize: 18, color: 'primary.main' }} />
                          ) : (
                            <HubIconMui sx={{ fontSize: 18, color: 'primary.main' }} />
                          )}
                        </Box>
                      ) : (
                        <HealthStatusIcon
                          status={asset.health_status as HealthStatus || 'unknown'}
                          issues={asset.health_issues}
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} color="primary.main">
                        {asset.label}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getAssetTypeName(asset.asset_type_code)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {asset.model || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {getClientName(asset.client_id)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {getSiteName(asset.site_id)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
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
              {t('assets.totalAssets', { total: totalCount })}
            </Typography>
            <PaginationComponent />
          </Box>
        </Paper>
      )}

      {/* Mobile FAB for create */}
      {isMobile && canCreateAsset && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => setFormOpen(true)}
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

      {/* Create Asset Form Dialog */}
      <AssetForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={handleFormSuccess}
      />
    </Box>
  );
};

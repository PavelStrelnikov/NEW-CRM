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
  CircularProgress,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
  Chip,
  Stack,
  Button,
  Card,
  CardContent,
  IconButton,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
  FilterList as FilterListIcon,
  LocationOn as LocationOnIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as ContentCopyIcon,
  Link as LinkIcon,
  ConfirmationNumber as TicketIcon,
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
import { Asset, AssetType, Site } from '@/types';
import { AssetForm } from '../Assets/AssetForm';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileFilterDrawer } from '@/components/Common/MobileFilterDrawer';
import { HealthStatusIcon } from '../Assets/HealthStatusIcon';
import { useToast } from '@/contexts/ToastContext';
import { copyToClipboard as copyText } from '@/utils/clipboard';
import type { HealthStatus } from '@/types';

// Readable monospace font stack for technical data
const MONO_FONT = '"SF Mono", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace';

interface ClientAssetsListProps {
  clientId: string;
}

// Extended asset with properties for display
interface AssetWithProps extends Asset {
  wan_http_port?: number;
  wan_service_port?: number;
  wan_proto?: string;
  device_username?: string;
  device_password?: string;
  // Router/Switch/AP properties (merged from EAV)
  provider_name?: string;
  wan_connection_type?: string;
  admin_username?: string;
  admin_password?: string;
  wifi_name?: string;
  wifi_password?: string;
  // Access Point
  ap_brand?: string;
  wifi_ssid?: string;
  // Switch
  switch_brand?: string;
  switch_managed?: boolean;
  total_ports?: number;
  poe_supported?: boolean;
}

export const ClientAssetsList: React.FC<ClientAssetsListProps> = ({ clientId }) => {
  const { t, i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const { showSuccess, showError } = useToast();

  // Check if user can create assets (admin or technician)
  const canCreateAsset = user?.role === 'admin' || user?.role === 'technician';
  const isPortalUser = user?.user_type === 'portal';

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedAssetTypeId, setSelectedAssetTypeId] = useState<string>('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Password visibility state (per asset ID)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Form dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Check if any filters are active
  const hasActiveFilters = selectedSiteId || selectedAssetTypeId || searchQuery;

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSiteId('');
    setSelectedAssetTypeId('');
  };

  // Toggle password visibility
  const togglePasswordVisibility = (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisiblePasswords(prev => ({
      ...prev,
      [assetId]: !prev[assetId]
    }));
  };

  // Copy to clipboard
  const handleCopy = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyText(text);
    if (success) {
      showSuccess(t('assets.copied'));
    } else {
      showError(t('app.copyError'));
    }
  };

  // Fetch assets for this client
  const { data: assetsData, isLoading: assetsLoading, error: assetsError } = useQuery({
    queryKey: ['assets', 'client', clientId, selectedSiteId, selectedAssetTypeId, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => {
      if (isPortalUser) {
        return portalAssetsApi.list({
          client_id: clientId,
          site_id: selectedSiteId || undefined,
          asset_type_id: selectedAssetTypeId || undefined,
          page_size: 100,
        });
      } else {
        return assetsApi.listAssets({
          client_id: clientId,
          site_id: selectedSiteId || undefined,
          asset_type_id: selectedAssetTypeId || undefined,
          page_size: 100,
        });
      }
    },
  });

  // Fetch sites for this client (for filter dropdown)
  const { data: sitesData } = useQuery({
    queryKey: ['sites', clientId, isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser ? portalClientsApi.listSites(clientId) : clientsApi.listSites(clientId),
  });

  // Fetch asset types (for filter dropdown)
  const { data: assetTypes } = useQuery({
    queryKey: ['assetTypes', isPortalUser ? 'portal' : 'admin'],
    queryFn: () => isPortalUser ? portalAssetsApi.getAssetTypes() : assetsApi.listAssetTypes(),
  });

  // Fetch details for all assets to get properties
  const assetsWithDetails = useQuery({
    queryKey: ['assetsWithDetails', clientId, assetsData?.items, isPortalUser ? 'portal' : 'admin'],
    queryFn: async () => {
      if (!assetsData?.items) return [];
      const detailsPromises = assetsData.items.map(asset => {
        if (isPortalUser) {
          return portalAssetsApi.get(asset.id).catch(() => null);
        } else {
          return assetsApi.getAsset(asset.id).catch(() => null);
        }
      });
      const details = await Promise.all(detailsPromises);
      return details.filter(d => d !== null);
    },
    enabled: !!assetsData?.items && assetsData.items.length > 0,
  });

  // Create lookup maps for display
  const sitesMap = useMemo(() => {
    const map: Record<string, Site> = {};
    sitesData?.items.forEach((site) => {
      map[site.id] = site;
    });
    return map;
  }, [sitesData]);

  const assetTypesMap = useMemo(() => {
    const map: Record<string, AssetType> = {};
    assetTypes?.forEach((type) => {
      map[type.id] = type;
    });
    return map;
  }, [assetTypes]);

  // Merge assets with their properties
  const assetsWithProps = useMemo((): AssetWithProps[] => {
    if (!assetsData?.items || !assetsWithDetails.data) return [];

    return assetsData.items.map(asset => {
      const detail = assetsWithDetails.data.find(d => d?.id === asset.id);
      if (!detail?.properties) return asset as AssetWithProps;

      const props: Record<string, any> = {};
      detail.properties.forEach(prop => {
        props[prop.key] = prop.value;
      });

      return {
        ...asset,
        ...props,
      } as AssetWithProps;
    });
  }, [assetsData?.items, assetsWithDetails.data]);

  // Client-side search filter
  const filteredAssets = useMemo(() => {
    if (!assetsWithProps) return [];
    if (!searchQuery.trim()) return assetsWithProps;

    const query = searchQuery.toLowerCase();
    return assetsWithProps.filter((asset) => {
      return (
        asset.label.toLowerCase().includes(query) ||
        asset.wan_public_ip?.toLowerCase().includes(query) ||
        asset.device_username?.toLowerCase().includes(query)
      );
    });
  }, [assetsWithProps, searchQuery]);

  // Get asset type display name
  const getAssetTypeName = (asset: Asset) => {
    const assetType = assetTypesMap[asset.asset_type_id];
    if (!assetType) return asset.asset_type_code || '-';
    return isHebrew ? (assetType.name_he || assetType.code) : (assetType.name_en || assetType.code);
  };

  // Get site display name
  const getSiteName = (asset: Asset) => {
    const site = sitesMap[asset.site_id];
    return site?.name || '-';
  };

  // Build web UI URL for asset
  const getWebUIUrl = (asset: AssetWithProps): string | null => {
    const wanIp = asset.wan_public_ip;
    const wanPort = asset.wan_http_port;
    const proto = asset.wan_proto || 'http';
    if (!wanIp) return null;
    const port = wanPort || 80;
    return `${proto}://${wanIp}:${port}`;
  };

  // Handle row click - navigate to asset details with return path
  const assetsBasePath = isPortalUser ? '/portal/assets' : '/admin/assets';
  const handleRowClick = (assetId: string) => {
    navigate(`${assetsBasePath}/${assetId}`, {
      state: { from: location.pathname + location.search },
    });
  };

  // Open web UI
  const handleOpenWebUI = (asset: AssetWithProps, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getWebUIUrl(asset);
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Handle form success
  const handleFormSuccess = () => {
    setIsFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ['assets', 'client', clientId] });
  };

  if (assetsError) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(assetsError as any).message}
      </Alert>
    );
  }

  const isLoading = assetsLoading || assetsWithDetails.isLoading;

  // Mobile Card component for asset
  const AssetCard: React.FC<{ asset: AssetWithProps }> = ({ asset }) => {
    const webUIUrl = getWebUIUrl(asset);
    const hasActiveTicket = asset.has_active_ticket;
    const isPasswordVisible = visiblePasswords[asset.id];

    return (
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        <CardContent sx={{ py: 1.5, px: 2 }}>
          {/* Header: Health + Name + Ticket Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {['ROUTER', 'ACCESS_POINT', 'SWITCH'].includes(asset.asset_type_code) ? (
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: '50%',
                bgcolor: 'rgba(25, 118, 210, 0.08)',
                flexShrink: 0,
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
                status={(asset.health_status as HealthStatus) || 'unknown'}
                issues={asset.health_issues}
                size="small"
              />
            )}
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, flex: 1, cursor: 'pointer' }}
              onClick={() => handleRowClick(asset.id)}
            >
              {asset.label}
            </Typography>
            {hasActiveTicket && (
              <Tooltip title={t('assets.hasActiveTicket')}>
                <TicketIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              </Tooltip>
            )}
          </Box>

          {/* Site */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {getSiteName(asset)}
            </Typography>
          </Box>

          {/* WAN / Connection Info */}
          {asset.asset_type_code === 'ROUTER' ? (
            /* Router: show WAN type + provider */
            (asset.wan_connection_type || asset.provider_name) && (
              <Box sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                  {t('router.internetConnection')}
                </Typography>
                {asset.wan_connection_type && (
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    {asset.wan_connection_type}
                  </Typography>
                )}
                {asset.provider_name && (
                  <Typography variant="caption" color="text.secondary">
                    {asset.provider_name}
                  </Typography>
                )}
              </Box>
            )
          ) : asset.wan_public_ip && (
            <Box sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                WAN
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: MONO_FONT, fontSize: '0.875rem', flex: 1 }} dir="ltr">
                  {asset.wan_public_ip}
                </Typography>
                <Tooltip title={t('app.copy')}>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCopy(asset.wan_public_ip!, e)}
                    sx={{ p: 0.25 }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, fontSize: '0.75rem' }}>
                <Typography variant="caption" color="text.secondary">
                  Web: {asset.wan_http_port || 80}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Service: {asset.wan_service_port || 8000}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(asset.wan_proto || 'http').toUpperCase()}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Credentials */}
          {(() => {
            const usesAdminCreds = ['ROUTER', 'SWITCH'].includes(asset.asset_type_code);
            const username = usesAdminCreds ? asset.admin_username : asset.device_username;
            const password = usesAdminCreds ? asset.admin_password : asset.device_password;
            if (!username) return null;
            return (
              <Box sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                  {t('assets.credentials')}
                </Typography>

                {/* Username */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: MONO_FONT, fontSize: '0.8rem', flex: 1 }} dir="ltr">
                    {username}
                  </Typography>
                  <Tooltip title={t('app.copy')}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleCopy(username, e)}
                      sx={{ p: 0.25 }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Password */}
                {password && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: MONO_FONT,
                        fontSize: '0.8rem',
                        flex: 1,
                        letterSpacing: isPasswordVisible ? 'normal' : '0.2em'
                      }}
                      dir="ltr"
                    >
                      {isPasswordVisible ? password : '••••••••'}
                    </Typography>
                    <Tooltip title={isPasswordVisible ? t('assets.hidePassword') : t('assets.showPassword')}>
                      <IconButton
                        size="small"
                        onClick={(e) => togglePasswordVisibility(asset.id, e)}
                        sx={{ p: 0.25 }}
                      >
                        {isPasswordVisible ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('app.copy')}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleCopy(password, e)}
                        sx={{ p: 0.25 }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            );
          })()}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {webUIUrl && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkIcon />}
                onClick={(e) => handleOpenWebUI(asset, e)}
                sx={{ flex: 1 }}
              >
                {t('assets.openWebUI')}
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              onClick={() => handleRowClick(asset.id)}
              sx={{ flex: webUIUrl ? 0 : 1, minWidth: webUIUrl ? 'auto' : undefined }}
            >
              {webUIUrl ? t('app.details') : t('assets.details')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Filter content - reusable for both inline and drawer
  const FilterContent = () => (
    <Stack spacing={2}>
      {/* Search Input */}
      <TextField
        size="small"
        fullWidth
        placeholder={t('assets.searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Site Filter */}
      <FormControl size="small" fullWidth>
        <InputLabel>{t('sites.title')}</InputLabel>
        <Select
          value={selectedSiteId}
          label={t('sites.title')}
          onChange={(e) => setSelectedSiteId(e.target.value)}
        >
          <MenuItem value="">{t('sites.allSites')}</MenuItem>
          {sitesData?.items.map((site) => (
            <MenuItem key={site.id} value={site.id}>
              {site.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Asset Type Filter */}
      <FormControl size="small" fullWidth>
        <InputLabel>{t('assets.type')}</InputLabel>
        <Select
          value={selectedAssetTypeId}
          label={t('assets.type')}
          onChange={(e) => setSelectedAssetTypeId(e.target.value)}
        >
          <MenuItem value="">{t('assets.allTypes')}</MenuItem>
          {assetTypes?.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {isHebrew ? (type.name_he || type.code) : (type.name_en || type.code)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );

  return (
    <Box>
      {/* Mobile: Compact header with filter button */}
      {isMobile ? (
        <Box sx={{ mb: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('assets.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <IconButton
            onClick={() => setIsFilterDrawerOpen(true)}
            sx={{
              border: 1,
              borderColor: hasActiveFilters ? 'primary.main' : 'divider',
              color: hasActiveFilters ? 'primary.main' : 'text.secondary',
            }}
          >
            <FilterListIcon />
          </IconButton>
        </Box>
      ) : (
        /* Desktop: Full filters bar */
        <Paper sx={{ p: 1.5, mb: 1.5 }} variant="outlined">
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            {/* Search Input */}
            <TextField
              size="small"
              placeholder={t('assets.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: 200, flex: '1 1 200px', maxWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {/* Site Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('sites.title')}</InputLabel>
              <Select
                value={selectedSiteId}
                label={t('sites.title')}
                onChange={(e) => setSelectedSiteId(e.target.value)}
              >
                <MenuItem value="">{t('sites.allSites')}</MenuItem>
                {sitesData?.items.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Asset Type Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('assets.type')}</InputLabel>
              <Select
                value={selectedAssetTypeId}
                label={t('assets.type')}
                onChange={(e) => setSelectedAssetTypeId(e.target.value)}
              >
                <MenuItem value="">{t('assets.allTypes')}</MenuItem>
                {assetTypes?.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {isHebrew ? (type.name_he || type.code) : (type.name_en || type.code)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* Add Asset Button */}
            {canCreateAsset && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setIsFormOpen(true)}
              >
                {t('assets.createAsset')}
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* Assets Content */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress size={28} />
        </Box>
      ) : filteredAssets.length === 0 ? (
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
          <Typography color="text.secondary">{t('assets.noAssets')}</Typography>
          {canCreateAsset && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setIsFormOpen(true)}
              sx={{ mt: 1.5 }}
            >
              {t('assets.createAsset')}
            </Button>
          )}
        </Paper>
      ) : isMobile ? (
        /* Mobile: Card view */
        <Stack spacing={1.5}>
          {filteredAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </Stack>
      ) : (
        /* Desktop/Tablet: Compact table view */
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem', width: '20%' }}>
                  {t('assets.label')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem', width: '15%' }}>
                  {t('sites.title')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem', width: '25%' }}>
                  {t('assets.wanAccess')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem', width: '20%' }}>
                  {t('assets.credentials')}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, py: 1, fontSize: '0.85rem', width: '20%' }}>
                  {t('app.actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAssets.map((asset) => {
                const webUIUrl = getWebUIUrl(asset);
                const isPasswordVisible = visiblePasswords[asset.id];
                const hasActiveTicket = asset.has_active_ticket;

                return (
                  <TableRow
                    key={asset.id}
                    hover
                    sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                  >
                    <TableCell sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {['ROUTER', 'ACCESS_POINT', 'SWITCH'].includes(asset.asset_type_code) ? (
                          <Box sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            bgcolor: 'rgba(25, 118, 210, 0.08)',
                            flexShrink: 0,
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
                            status={(asset.health_status as HealthStatus) || 'unknown'}
                            issues={asset.health_issues}
                            size="small"
                          />
                        )}
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography
                              variant="body2"
                              fontWeight="medium"
                              sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                              onClick={() => handleRowClick(asset.id)}
                            >
                              {asset.label}
                            </Typography>
                            {hasActiveTicket && (
                              <Tooltip title={t('assets.hasActiveTicket')}>
                                <TicketIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                        {getSiteName(asset)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {asset.asset_type_code === 'ROUTER' ? (
                        /* Router: show WAN type + provider */
                        (asset.wan_connection_type || asset.provider_name) ? (
                          <Box>
                            {asset.wan_connection_type && (
                              <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                {asset.wan_connection_type}
                              </Typography>
                            )}
                            {asset.provider_name && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                {asset.provider_name}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )
                      ) : asset.wan_public_ip ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                            <Typography variant="body2" sx={{ fontFamily: MONO_FONT, fontSize: '0.85rem' }} dir="ltr">
                              {asset.wan_public_ip}
                            </Typography>
                            <Tooltip title={t('app.copy')}>
                              <IconButton
                                size="small"
                                onClick={(e) => handleCopy(asset.wan_public_ip!, e)}
                                sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 12 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {(asset.wan_proto || 'http').toUpperCase()}:{asset.wan_http_port || 80} / {asset.wan_service_port || 8000}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      {(() => {
                        const usesAdminCreds = ['ROUTER', 'SWITCH'].includes(asset.asset_type_code);
                        const username = usesAdminCreds ? asset.admin_username : asset.device_username;
                        const password = usesAdminCreds ? asset.admin_password : asset.device_password;
                        return username ? (
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                              <Typography variant="body2" sx={{ fontFamily: MONO_FONT, fontSize: '0.8rem' }} dir="ltr">
                                {username}
                              </Typography>
                              <Tooltip title={t('app.copy')}>
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleCopy(username, e)}
                                  sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            {password && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: MONO_FONT,
                                    fontSize: '0.8rem',
                                    letterSpacing: isPasswordVisible ? 'normal' : '0.2em'
                                  }}
                                  dir="ltr"
                                >
                                  {isPasswordVisible ? password : '••••••'}
                                </Typography>
                                <Tooltip title={isPasswordVisible ? t('assets.hidePassword') : t('assets.showPassword')}>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => togglePasswordVisibility(asset.id, e)}
                                    sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
                                  >
                                    {isPasswordVisible ? <VisibilityOffIcon sx={{ fontSize: 12 }} /> : <VisibilityIcon sx={{ fontSize: 12 }} />}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('app.copy')}>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleCopy(password, e)}
                                    sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
                                  >
                                    <ContentCopyIcon sx={{ fontSize: 12 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        );
                      })()}
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1 }}>
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {webUIUrl && (
                          <Tooltip title={t('assets.openWebUI')}>
                            <IconButton
                              size="small"
                              onClick={(e) => handleOpenWebUI(asset, e)}
                              sx={{ p: 0.5 }}
                            >
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={t('assets.details')}>
                          <IconButton
                            size="small"
                            onClick={() => handleRowClick(asset.id)}
                            sx={{ p: 0.5 }}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Results count */}
      {!isLoading && assetsData && filteredAssets.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Typography variant="caption" color="text.secondary">
            {t('tickets.ofTotal', {
              count: filteredAssets.length,
              total: assetsData.total,
            })}
          </Typography>
        </Box>
      )}

      {/* Mobile FAB for adding */}
      {isMobile && canCreateAsset && filteredAssets.length > 0 && (
        <Fab
          color="primary"
          size="medium"
          onClick={() => setIsFormOpen(true)}
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

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        open={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onReset={handleClearFilters}
        showReset={!!hasActiveFilters}
      >
        <FilterContent />
      </MobileFilterDrawer>

      {/* Asset Form Dialog */}
      <AssetForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
        preSelectedClientId={clientId}
        preSelectedSiteId={selectedSiteId || undefined}
      />
    </Box>
  );
};

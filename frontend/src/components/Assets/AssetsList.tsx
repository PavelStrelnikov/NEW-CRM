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
  TextField,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
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
import { assetsApi } from '@/api/assets';
import { clientsApi } from '@/api/clients';

export const AssetsList: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');

  // Fetch assets (max page_size is 100 per backend validation)
  const { data: assetsData, isLoading, error } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.listAssets({ page_size: 100 }),
  });

  // Fetch asset types
  const { data: assetTypes } = useQuery({
    queryKey: ['asset-types'],
    queryFn: () => assetsApi.listAssetTypes(),
  });

  // Fetch clients for filter (max page_size is 100 per backend validation)
  const { data: clientsData } = useQuery({
    queryKey: ['clients-filter'],
    queryFn: () => clientsApi.listClients({ page_size: 100 }),
  });

  // Create lookup maps
  const assetTypeMap = useMemo(() => {
    if (!assetTypes) return new Map();
    return new Map(assetTypes.map(t => [t.code, t]));
  }, [assetTypes]);

  const clientMap = useMemo(() => {
    if (!clientsData?.items) return new Map();
    return new Map(clientsData.items.map(c => [c.id, c]));
  }, [clientsData]);

  // Get unique manufacturers for filter
  const manufacturers = useMemo(() => {
    if (!assetsData?.items) return [];
    const unique = new Set(
      assetsData.items
        .map(a => a.manufacturer)
        .filter((m): m is string => !!m)
    );
    return Array.from(unique).sort();
  }, [assetsData]);

  // Helper functions
  const getAssetTypeName = (code: string): string => {
    const type = assetTypeMap.get(code);
    if (!type) return code;
    return locale === 'he' ? type.display_name_he : type.display_name_en;
  };

  const getClientName = (clientId: string): string => {
    return clientMap.get(clientId)?.name || clientId;
  };

  // Apply filters
  const filteredAssets = useMemo(() => {
    if (!assetsData?.items) return [];

    return assetsData.items.filter(asset => {
      // Search filter
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

      // Status filter
      if (statusFilter && asset.status !== statusFilter) {
        return false;
      }

      // Client filter
      if (clientFilter && asset.client_id !== clientFilter) {
        return false;
      }

      // Manufacturer filter
      if (manufacturerFilter && asset.manufacturer !== manufacturerFilter) {
        return false;
      }

      return true;
    });
  }, [assetsData, searchQuery, typeFilter, statusFilter, clientFilter, manufacturerFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setTypeFilter('');
    setStatusFilter('');
    setClientFilter('');
    setManufacturerFilter('');
  };

  const hasActiveFilters = searchQuery || typeFilter || statusFilter || clientFilter || manufacturerFilter;

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{t('assets.title')}</Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('assets.searchPlaceholder')}
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
              label={t('assets.type')}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="">{t('assets.allTypes')}</MenuItem>
              {assetTypes?.map((type) => (
                <MenuItem key={type.code} value={type.code}>
                  {locale === 'he' ? type.display_name_he : type.display_name_en}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              size="small"
              label={t('assets.manufacturer')}
              value={manufacturerFilter}
              onChange={(e) => setManufacturerFilter(e.target.value)}
            >
              <MenuItem value="">{t('assets.allManufacturers')}</MenuItem>
              {manufacturers.map((mfr) => (
                <MenuItem key={mfr} value={mfr}>
                  {mfr}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              size="small"
              label={t('assets.status')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">{t('assets.allStatuses')}</MenuItem>
              <MenuItem value="active">{t('assets.statusActive')}</MenuItem>
              <MenuItem value="inactive">{t('assets.statusInactive')}</MenuItem>
              <MenuItem value="maintenance">{t('assets.statusMaintenance')}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              select
              size="small"
              label={t('clients.title')}
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
          <Grid item xs={12} sm={12} md={1}>
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
      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : filteredAssets.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Box textAlign="center">
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
          </Box>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('assets.label')}</TableCell>
                <TableCell>{t('assets.type')}</TableCell>
                <TableCell>{t('assets.manufacturer')}</TableCell>
                <TableCell>{t('assets.model')}</TableCell>
                <TableCell>{t('assets.serialNumber')}</TableCell>
                <TableCell>{t('clients.title')}</TableCell>
                <TableCell>{t('assets.status')}</TableCell>
                <TableCell align="center">{t('app.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAssets.map((asset) => (
                <TableRow key={asset.id} hover>
                  <TableCell>{asset.label}</TableCell>
                  <TableCell>{getAssetTypeName(asset.asset_type_code)}</TableCell>
                  <TableCell>{asset.manufacturer || '-'}</TableCell>
                  <TableCell>{asset.model || '-'}</TableCell>
                  <TableCell>{asset.serial_number || '-'}</TableCell>
                  <TableCell>{getClientName(asset.client_id)}</TableCell>
                  <TableCell>
                    <Chip label={asset.status} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/assets/${asset.id}`)}
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
      {!isLoading && filteredAssets.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {hasActiveFilters
              ? `${filteredAssets.length} / ${assetsData?.total || 0}`
              : `${assetsData?.total || 0}`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

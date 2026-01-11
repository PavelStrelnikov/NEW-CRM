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
  TextField,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { Visibility as ViewIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { assetsApi } from '@/api/assets';

export const AssetsList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', searchQuery, page],
    queryFn: () => assetsApi.listAssets({ q: searchQuery, page, page_size: 25 }),
  });

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">{t('assets.title')}</Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder={t('assets.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
        />
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
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
                <TableCell>{t('assets.status')}</TableCell>
                <TableCell align="center">{t('app.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {t('assets.noAssets')}
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((asset) => (
                  <TableRow key={asset.id} hover>
                    <TableCell>{asset.label}</TableCell>
                    <TableCell>{asset.asset_type_code}</TableCell>
                    <TableCell>{asset.manufacturer || '-'}</TableCell>
                    <TableCell>{asset.model || '-'}</TableCell>
                    <TableCell>{asset.serial_number || '-'}</TableCell>
                    <TableCell>
                      <Chip label={asset.status} size="small" color="success" />
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
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {data && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {data.items.length} / {data.total}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

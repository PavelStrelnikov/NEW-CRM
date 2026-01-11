import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { auditApi } from '@/api/audit';
import { format } from 'date-fns';

export const ActivityLogPage: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [entityType, setEntityType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-events', page + 1, pageSize, entityType, fromDate, toDate],
    queryFn: () =>
      auditApi.listEvents({
        page: page + 1,
        page_size: pageSize,
        entity_type: entityType || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }),
  });

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'success';
      case 'update':
        return 'info';
      case 'delete':
      case 'deactivate':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('activity.title')}
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>{t('activity.entityType')}</InputLabel>
            <Select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(0);
              }}
              label={t('activity.entityType')}
            >
              <MenuItem value="">{t('activity.all')}</MenuItem>
              <MenuItem value="client">{t('activity.client')}</MenuItem>
              <MenuItem value="site">{t('activity.site')}</MenuItem>
              <MenuItem value="contact">{t('activity.contact')}</MenuItem>
              <MenuItem value="asset">{t('activity.asset')}</MenuItem>
              <MenuItem value="ticket">{t('activity.ticket')}</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label={t('activity.fromDate')}
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label={t('activity.toDate')}
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Paper>

      {error ? (
        <Alert severity="error">
          {t('app.error')}: {(error as any).message}
        </Alert>
      ) : isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('activity.date')}</TableCell>
                  <TableCell>{t('activity.actor')}</TableCell>
                  <TableCell>{t('activity.action')}</TableCell>
                  <TableCell>{t('activity.entityType')}</TableCell>
                  <TableCell>{t('activity.details')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {t('activity.noEvents')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map((event) => (
                    <TableRow key={event.id} hover>
                      <TableCell>
                        {format(new Date(event.created_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>{event.actor_display}</TableCell>
                      <TableCell>
                        <Chip
                          label={event.action}
                          size="small"
                          color={getActionColor(event.action)}
                        />
                      </TableCell>
                      <TableCell>{event.entity_type}</TableCell>
                      <TableCell>
                        {event.action === 'create' && event.new_values_json && (
                          <Typography variant="body2">
                            Created: {JSON.stringify(event.new_values_json).substring(0, 100)}...
                          </Typography>
                        )}
                        {event.action === 'update' && event.old_values_json && event.new_values_json && (
                          <Typography variant="body2">
                            Changed: {Object.keys(event.new_values_json).join(', ')}
                          </Typography>
                        )}
                        {(event.action === 'delete' || event.action === 'deactivate') && event.old_values_json && (
                          <Typography variant="body2">
                            {event.action === 'delete' ? 'Deleted' : 'Deactivated'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.total || 0}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}
    </Box>
  );
};

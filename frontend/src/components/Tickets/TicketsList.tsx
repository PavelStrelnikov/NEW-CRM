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
import { ticketsApi } from '@/api/tickets';
import { format } from 'date-fns';

export const TicketsList: React.FC = () => {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', page],
    queryFn: () => ticketsApi.listTickets({ page, page_size: 25 }),
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
        <Typography variant="h4">{t('tickets.title')}</Typography>
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
              {data?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {t('tickets.noTickets')}
                  </TableCell>
                </TableRow>
              ) : (
                data?.items.map((ticket) => (
                  <TableRow key={ticket.id} hover>
                    <TableCell>{ticket.ticket_number}</TableCell>
                    <TableCell>{ticket.title}</TableCell>
                    <TableCell>{ticket.client_id}</TableCell>
                    <TableCell>
                      <Chip label={ticket.status_id} size="small" />
                    </TableCell>
                    <TableCell>
                      {ticket.priority ? (
                        <Chip label={ticket.priority} size="small" color="warning" />
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

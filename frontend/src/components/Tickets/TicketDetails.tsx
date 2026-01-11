import React, { useState } from 'react';
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
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ticketsApi } from '@/api/tickets';
import { format } from 'date-fns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { WorkLogForm } from './WorkLogForm';
import { LineItemForm } from './LineItemForm';

export const TicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  const [isWorkLogDialogOpen, setIsWorkLogDialogOpen] = useState(false);
  const [isLineItemDialogOpen, setIsLineItemDialogOpen] = useState(false);

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => ticketsApi.getTicket(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !ticket) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any)?.message || 'Ticket not found'}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/tickets')}
        >
          {t('app.back')}
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {ticket.ticket_number}: {ticket.title}
        </Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.description')}
            </Typography>
            <Typography variant="body1">{ticket.description}</Typography>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.status')}
            </Typography>
            <Typography variant="body1">{ticket.status_id}</Typography>
          </Grid>

          <Grid item xs={12} sm={3}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.priority')}
            </Typography>
            <Typography variant="body1">{ticket.priority || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.contactPhone')}
            </Typography>
            <Typography variant="body1">{ticket.contact_phone}</Typography>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.contactName')}
            </Typography>
            <Typography variant="body1">{ticket.contact_name || '-'}</Typography>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              {t('tickets.createdAt')}
            </Typography>
            <Typography variant="body1">
              {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label={t('tickets.events')} />
          <Tab label={t('tickets.workLogs')} />
          <Tab label={t('tickets.lineItems')} />
        </Tabs>
      </Box>

      {currentTab === 0 && (
        <Paper>
          <List>
            {ticket.events?.length === 0 ? (
              <ListItem>
                <ListItemText primary="No events" />
              </ListItem>
            ) : (
              ticket.events?.map((event, idx) => (
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

      {currentTab === 1 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => setIsWorkLogDialogOpen(true)}>
              {t('tickets.addWorkLog')}
            </Button>
          </Box>
          <Paper>
            <List>
              {ticket.work_logs?.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No work logs" />
                </ListItem>
              ) : (
                ticket.work_logs?.map((log, idx) => (
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

      {currentTab === 2 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => setIsLineItemDialogOpen(true)}>
              {t('tickets.addLineItem')}
            </Button>
          </Box>
          <Paper>
            <List>
              {ticket.line_items?.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No line items" />
                </ListItem>
              ) : (
                ticket.line_items?.map((item, idx) => (
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

import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  alpha,
  Badge,
  Skeleton,
} from '@mui/material';
import {
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ticketsApi } from '@/api/tickets';
import { portalTicketsApi } from '@/api/portalTickets';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { STATUS_MAP } from '@/constants/statusMap';
import { format } from 'date-fns';
import type { Ticket, TicketStatus } from '@/types';

const PRIORITY_COLORS = {
  low: 'default',
  normal: 'info',
  high: 'warning',
  urgent: 'error',
} as const;

const COLUMN_WIDTH = 300;
const COLUMN_MIN_HEIGHT = 400;

// ─── Draggable Ticket Card ───────────────────────────────────────────────────

interface DraggableCardProps {
  ticket: Ticket;
  locale: string;
  getClientName: (id: string) => string;
  getPriorityLabel: (p?: string) => string;
  onClick: () => void;
  isPortalUser: boolean;
}

const DraggableTicketCard: React.FC<DraggableCardProps> = ({
  ticket,
  locale,
  getClientName,
  getPriorityLabel,
  onClick,
  isPortalUser,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
    disabled: isPortalUser,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: isPortalUser ? 'pointer' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TicketCardContent
        ticket={ticket}
        locale={locale}
        getClientName={getClientName}
        getPriorityLabel={getPriorityLabel}
        onClick={onClick}
      />
    </div>
  );
};

// ─── Ticket Card Content (shared between draggable and overlay) ──────────────

interface TicketCardContentProps {
  ticket: Ticket;
  locale: string;
  getClientName: (id: string) => string;
  getPriorityLabel: (p?: string) => string;
  onClick: () => void;
}

const TicketCardContent: React.FC<TicketCardContentProps> = ({
  ticket,
  locale,
  getClientName,
  getPriorityLabel,
  onClick,
}) => {
  const statusConfig = ticket.status_code ? STATUS_MAP[ticket.status_code] : null;

  return (
    <Card
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        mb: 1,
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
        },
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {/* Header: ticket number + priority */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography
              variant="caption"
              fontFamily="monospace"
              fontWeight={600}
              color="primary.main"
            >
              {ticket.ticket_number}
            </Typography>
            {ticket.priority && (
              <Chip
                label={getPriorityLabel(ticket.priority)}
                size="small"
                color={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}
                variant="outlined"
                sx={{ height: 20, fontSize: '0.65rem' }}
              />
            )}
          </Box>

          {/* Title */}
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
              fontSize: '0.8rem',
            }}
          >
            {ticket.title}
          </Typography>

          {/* Footer: client + assigned + date */}
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BusinessIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 180, fontSize: '0.7rem' }}>
                {getClientName(ticket.client_id)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {ticket.assigned_to_name ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                    {ticket.assigned_to_name}
                  </Typography>
                </Box>
              ) : (
                <Box />
              )}
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
                {format(new Date(ticket.created_at), 'dd/MM HH:mm')}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// ─── Droppable Column ────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: TicketStatus;
  tickets: Ticket[];
  locale: string;
  getClientName: (id: string) => string;
  getPriorityLabel: (p?: string) => string;
  onTicketClick: (id: string) => void;
  isOver: boolean;
  isPortalUser: boolean;
  t: (key: string) => string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tickets,
  locale,
  getClientName,
  getPriorityLabel,
  onTicketClick,
  isOver,
  isPortalUser,
  t,
}) => {
  const { setNodeRef } = useDroppable({ id: status.code });
  const statusConfig = STATUS_MAP[status.code];
  const statusLabel = statusConfig
    ? locale === 'he' ? statusConfig.label_he : statusConfig.label_en
    : status.code;

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      sx={{
        width: COLUMN_WIDTH,
        minWidth: COLUMN_WIDTH,
        minHeight: COLUMN_MIN_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: isOver ? 'primary.main' : 'divider',
        borderRadius: 2,
        bgcolor: isOver
          ? (theme) => alpha(theme.palette.primary.main, 0.06)
          : (theme) => alpha(theme.palette.background.paper, 0.6),
        transition: 'border-color 0.2s, background-color 0.2s',
      }}
    >
      {/* Column Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
          borderRadius: '8px 8px 0 0',
        }}
      >
        {statusConfig && (
          <Box sx={{ display: 'flex', color: `${statusConfig.color}.main` }}>
            {React.cloneElement(statusConfig.icon, { fontSize: 'small' })}
          </Box>
        )}
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          {statusLabel}
        </Typography>
        <Badge
          badgeContent={tickets.length}
          color={statusConfig?.color || 'default'}
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              height: 18,
              minWidth: 18,
            },
          }}
        />
      </Box>

      {/* Column Body */}
      <Box
        sx={{
          p: 1,
          flex: 1,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 320px)',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'divider',
            borderRadius: 2,
          },
        }}
      >
        {tickets.length === 0 ? (
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              color: 'text.disabled',
            }}
          >
            <Typography variant="caption">
              {t('tickets.kanbanEmpty')}
            </Typography>
          </Box>
        ) : (
          tickets.map((ticket) => (
            <DraggableTicketCard
              key={ticket.id}
              ticket={ticket}
              locale={locale}
              getClientName={getClientName}
              getPriorityLabel={getPriorityLabel}
              onClick={() => onTicketClick(ticket.id)}
              isPortalUser={isPortalUser}
            />
          ))
        )}
      </Box>
    </Paper>
  );
};

// ─── Main Kanban Component ───────────────────────────────────────────────────

export const TicketsKanban: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const isPortalUser = user?.user_type === 'portal';
  const basePath = location.pathname.startsWith('/portal') ? '/portal/tickets' : '/admin/tickets';

  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  // Sensor with activation distance to distinguish click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Fetch ticket statuses
  const { data: statuses } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: () => ticketsApi.listTicketStatuses(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all tickets (page_size=100 for kanban overview)
  const { data: ticketsData, isLoading, error } = useQuery({
    queryKey: ['tickets', { page_size: 100, hide_closed: false }],
    queryFn: () =>
      isPortalUser
        ? portalTicketsApi.list({ page: 1, page_size: 100 })
        : ticketsApi.listTickets({ page: 1, page_size: 100, hide_closed: false }),
  });

  // Fetch clients for name lookup
  const { data: clientsData } = useQuery({
    queryKey: ['clients-filter'],
    queryFn: async () => {
      if (user?.user_type === 'portal') {
        const response = await portalClientsApi.list();
        return { items: response.items, total: response.total, page: 1, page_size: response.total };
      }
      return clientsApi.listClients({ page_size: 100 });
    },
    enabled: !!user,
  });

  // Status change mutation
  const changeStatusMutation = useMutation({
    mutationFn: ({ ticketId, statusId }: { ticketId: string; statusId: string }) =>
      ticketsApi.changeStatus(ticketId, statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      showSuccess(t('tickets.ticketMoved'));
    },
    onError: () => {
      showError(t('tickets.ticketMoveFailed'));
    },
  });

  // Maps & helpers
  const clientMap = useMemo(() => {
    if (!clientsData?.items) return new Map<string, string>();
    return new Map(clientsData.items.map((c) => [c.id, c.name]));
  }, [clientsData]);

  const getClientName = useCallback(
    (clientId: string) => clientMap.get(clientId) || clientId,
    [clientMap]
  );

  const getPriorityLabel = useCallback(
    (priority?: string) => {
      if (!priority) return '-';
      const key = `tickets.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
      return t(key);
    },
    [t]
  );

  // Sort statuses by sort_order
  const sortedStatuses = useMemo(
    () => (statuses || []).filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [statuses]
  );

  // Status ID lookup by code
  const statusIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    (statuses || []).forEach((s) => map.set(s.code, s.id));
    return map;
  }, [statuses]);

  // Group tickets by status_code
  const ticketsByStatus = useMemo(() => {
    const groups: Record<string, Ticket[]> = {};
    sortedStatuses.forEach((s) => {
      groups[s.code] = [];
    });
    (ticketsData?.items || []).forEach((ticket) => {
      const code = ticket.status_code || '';
      if (groups[code]) {
        groups[code].push(ticket);
      }
    });
    return groups;
  }, [ticketsData, sortedStatuses]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as Ticket;
    setActiveTicket(ticket || null);
  };

  const handleDragOver = (event: any) => {
    const overId = event.over?.id as string | null;
    setOverColumn(overId || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTicket(null);
    setOverColumn(null);

    const { active, over } = event;
    if (!over) return;

    const ticket = active.data.current?.ticket as Ticket;
    const targetStatusCode = over.id as string;

    if (!ticket || ticket.status_code === targetStatusCode) return;

    const targetStatusId = statusIdByCode.get(targetStatusCode);
    if (!targetStatusId) return;

    // Optimistically update the query data
    queryClient.setQueryData(
      ['tickets', { page_size: 100, hide_closed: false }],
      (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((t: Ticket) =>
            t.id === ticket.id ? { ...t, status_code: targetStatusCode, status_id: targetStatusId } : t
          ),
        };
      }
    );

    changeStatusMutation.mutate({ ticketId: ticket.id, statusId: targetStatusId });
  };

  const handleDragCancel = () => {
    setActiveTicket(null);
    setOverColumn(null);
  };

  if (error) {
    return (
      <Alert severity="error">
        {t('app.error')}: {(error as any).message}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Paper
            key={i}
            elevation={0}
            sx={{
              width: COLUMN_WIDTH,
              minWidth: COLUMN_WIDTH,
              minHeight: COLUMN_MIN_HEIGHT,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              p: 1.5,
            }}
          >
            <Skeleton variant="text" width="60%" height={28} sx={{ mb: 2 }} />
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} variant="rounded" height={100} sx={{ mb: 1, borderRadius: 1.5 }} />
            ))}
          </Paper>
        ))}
      </Box>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2,
          minHeight: COLUMN_MIN_HEIGHT + 60,
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'divider',
            borderRadius: 3,
          },
        }}
      >
        {sortedStatuses.map((status) => (
          <KanbanColumn
            key={status.code}
            status={status}
            tickets={ticketsByStatus[status.code] || []}
            locale={locale}
            getClientName={getClientName}
            getPriorityLabel={getPriorityLabel}
            onTicketClick={(id) => navigate(`${basePath}/${id}`)}
            isOver={overColumn === status.code}
            isPortalUser={isPortalUser}
            t={t}
          />
        ))}
      </Box>

      {/* Drag overlay - shows a floating card while dragging */}
      <DragOverlay>
        {activeTicket ? (
          <Box sx={{ width: COLUMN_WIDTH - 16, opacity: 0.9 }}>
            <TicketCardContent
              ticket={activeTicket}
              locale={locale}
              getClientName={getClientName}
              getPriorityLabel={getPriorityLabel}
              onClick={() => {}}
            />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

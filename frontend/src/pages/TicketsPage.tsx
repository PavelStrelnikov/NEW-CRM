import React, { useState } from 'react';
import {
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import {
  ViewList as ViewListIcon,
  ViewKanban as ViewKanbanIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { TicketsList } from '@/components/Tickets/TicketsList';
import { TicketsKanban } from '@/components/Tickets/TicketsKanban';

type ViewMode = 'list' | 'kanban';

const STORAGE_KEY = 'crm.tickets.viewMode';

const getInitialViewMode = (): ViewMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'list' || stored === 'kanban') return stored;
  } catch {}
  return 'list';
};

export const TicketsPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);

  const handleViewChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) {
      setViewMode(newMode);
      try { localStorage.setItem(STORAGE_KEY, newMode); } catch {}
    }
  };

  return (
    <Box>
      {/* View toggle - positioned top-right, above the list/kanban content */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.5,
              py: 0.5,
              border: 1,
              borderColor: 'divider',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              },
            },
          }}
        >
          <ToggleButton value="list">
            <Tooltip title={t('tickets.viewList')}>
              <ViewListIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="kanban">
            <Tooltip title={t('tickets.viewKanban')}>
              <ViewKanbanIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === 'list' ? <TicketsList /> : <TicketsKanban />}
    </Box>
  );
};

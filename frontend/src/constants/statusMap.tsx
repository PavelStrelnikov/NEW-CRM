import React from 'react';
import {
  FiberNew as NewIcon,
  PlayArrow as InProgressIcon,
  HourglassEmpty as WaitingIcon,
  CheckCircle as ResolvedIcon,
  Cancel as ClosedIcon,
} from '@mui/icons-material';
import { ChipProps } from '@mui/material';

export interface StatusConfig {
  icon: React.ReactElement;
  color: ChipProps['color'];
  label_he: string;
  label_en: string;
}

export const STATUS_MAP: Record<string, StatusConfig> = {
  NEW: {
    icon: <NewIcon />,
    color: 'primary',
    label_he: 'חדש',
    label_en: 'New',
  },
  IN_PROGRESS: {
    icon: <InProgressIcon />,
    color: 'info',
    label_he: 'בטיפול',
    label_en: 'In Progress',
  },
  WAITING_CUSTOMER: {
    icon: <WaitingIcon />,
    color: 'warning',
    label_he: 'ממתין ללקוח',
    label_en: 'Waiting for Customer',
  },
  RESOLVED: {
    icon: <ResolvedIcon />,
    color: 'success',
    label_he: 'נפתר',
    label_en: 'Resolved',
  },
  CLOSED: {
    icon: <ClosedIcon />,
    color: 'default',
    label_he: 'סגור',
    label_en: 'Closed',
  },
};

/**
 * MUI Component Overrides
 * Modern styling for all MUI components
 * All colors use theme.palette for proper dark mode support
 */

import { Components, Theme } from '@mui/material/styles';
import { tokens } from './tokens';

export const createComponentOverrides = (theme: Theme): Components<Theme> => ({
  // Button
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.md,
        textTransform: 'none',
        fontWeight: tokens.typography.fontWeight.medium,
        boxShadow: 'none',
        '&:hover': {
          boxShadow: 'none',
        },
      },
      sizeLarge: {
        padding: '12px 24px',
        fontSize: tokens.typography.fontSize.base,
      },
      sizeMedium: {
        padding: '8px 16px',
        fontSize: tokens.typography.fontSize.sm,
      },
      sizeSmall: {
        padding: '6px 12px',
        fontSize: tokens.typography.fontSize.sm,
      },
      contained: {
        '&:hover': {
          boxShadow: tokens.shadows.sm,
        },
      },
    },
  },

  // IconButton
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.md,
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      },
    },
  },

  // TextField
  MuiTextField: {
    defaultProps: {
      variant: 'outlined',
      size: 'medium',
      InputLabelProps: {
        shrink: true,
      },
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.md,
        backgroundColor: theme.palette.background.paper,
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.palette.primary.light,
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderWidth: 2,
          borderColor: theme.palette.primary.main,
        },
      },
      input: {
        padding: '12px 14px',
      },
    },
  },

  MuiInputLabel: {
    styleOverrides: {
      root: {
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.medium,
        color: theme.palette.text.secondary,
        '&.Mui-focused': {
          color: theme.palette.primary.main,
        },
      },
    },
  },

  // Paper
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.lg,
        boxShadow: tokens.shadows.sm,
        backgroundImage: 'none', // Remove gradient in dark mode
      },
      elevation0: {
        boxShadow: 'none',
      },
      elevation1: {
        boxShadow: tokens.shadows.sm,
      },
      elevation2: {
        boxShadow: tokens.shadows.md,
      },
      elevation3: {
        boxShadow: tokens.shadows.lg,
      },
    },
  },

  // Card
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.lg,
        boxShadow: tokens.shadows.sm,
        border: `1px solid ${theme.palette.divider}`,
        backgroundImage: 'none',
      },
    },
  },

  // Table
  MuiTableContainer: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.lg,
        border: `1px solid ${theme.palette.divider}`,
      },
    },
  },

  MuiTable: {
    styleOverrides: {
      root: {
        borderCollapse: 'separate',
        borderSpacing: 0,
      },
    },
  },

  MuiTableHead: {
    styleOverrides: {
      root: {
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.03)'
          : 'rgba(0, 0, 0, 0.02)',
      },
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${theme.palette.divider}`,
        padding: '16px',
        fontSize: tokens.typography.fontSize.sm,
        color: theme.palette.text.primary,
      },
      head: {
        fontWeight: tokens.typography.fontWeight.semibold,
        color: theme.palette.text.primary,
        fontSize: tokens.typography.fontSize.sm,
        textTransform: 'none',
        borderBottom: `2px solid ${theme.palette.divider}`,
      },
      body: {
        color: theme.palette.text.primary,
      },
    },
  },

  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
        '&:last-child td': {
          borderBottom: 'none',
        },
      },
    },
  },

  // Chip
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.sm,
        fontWeight: tokens.typography.fontWeight.medium,
        fontSize: tokens.typography.fontSize.xs,
      },
      sizeSmall: {
        height: 24,
        fontSize: tokens.typography.fontSize.xs,
      },
      sizeMedium: {
        height: 32,
        fontSize: tokens.typography.fontSize.sm,
      },
    },
  },

  // AppBar
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: tokens.shadows.sm,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        borderBottom: `1px solid ${theme.palette.divider}`,
      },
    },
  },

  // Drawer
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRight: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
      },
    },
  },

  // ListItemButton
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.md,
        margin: '4px 8px',
        '&.Mui-selected': {
          backgroundColor: theme.palette.action.selected,
          color: theme.palette.primary.main,
          '&:hover': {
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(76, 141, 255, 0.16)'
              : tokens.colors.primary[100],
          },
          '& .MuiListItemIcon-root': {
            color: theme.palette.primary.main,
          },
        },
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      },
    },
  },

  MuiListItemIcon: {
    styleOverrides: {
      root: {
        minWidth: 40,
        color: theme.palette.text.secondary,
      },
    },
  },

  // Tabs
  MuiTabs: {
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${theme.palette.divider}`,
      },
      indicator: {
        height: 3,
        borderRadius: '3px 3px 0 0',
      },
    },
  },

  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: tokens.typography.fontWeight.medium,
        fontSize: tokens.typography.fontSize.sm,
        minHeight: 48,
        '&.Mui-selected': {
          color: theme.palette.primary.main,
          fontWeight: tokens.typography.fontWeight.semibold,
        },
      },
    },
  },

  // Alert
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: tokens.borderRadius.md,
        fontSize: tokens.typography.fontSize.sm,
      },
      standardSuccess: {
        backgroundColor: tokens.colors.success.light,
        color: tokens.colors.success.dark,
      },
      standardError: {
        backgroundColor: tokens.colors.error.light,
        color: tokens.colors.error.dark,
      },
      standardWarning: {
        backgroundColor: tokens.colors.warning.light,
        color: tokens.colors.warning.dark,
      },
      standardInfo: {
        backgroundColor: tokens.colors.info.light,
        color: tokens.colors.info.dark,
      },
    },
  },

  // Dialog
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: tokens.borderRadius.lg,
        boxShadow: tokens.shadows.xl,
        backgroundImage: 'none',
      },
    },
  },

  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: tokens.typography.fontSize['2xl'],
        fontWeight: tokens.typography.fontWeight.semibold,
        padding: '24px',
      },
    },
  },

  MuiDialogContent: {
    styleOverrides: {
      root: {
        padding: '24px',
      },
    },
  },

  MuiDialogActions: {
    styleOverrides: {
      root: {
        padding: '16px 24px',
        gap: '8px',
      },
    },
  },

  // Menu
  MuiMenu: {
    styleOverrides: {
      paper: {
        backgroundImage: 'none',
      },
    },
  },
});

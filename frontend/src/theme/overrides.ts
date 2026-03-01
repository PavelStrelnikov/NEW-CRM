/**
 * MUI Component Overrides
 * Dark surveillance theme — teal accents, glassmorphism, ambient glow
 */

import { Components, Theme, alpha } from '@mui/material/styles';
import { tokens } from './tokens';

export const createComponentOverrides = (theme: Theme): Components<Theme> => {
  const isDark = theme.palette.mode === 'dark';
  const teal = tokens.accent.teal;
  const tealDim = tokens.accent.tealDim;

  return {
    // CssBaseline — ambient gradient & custom scrollbar
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          '&::before': isDark ? {
            content: '""',
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'none',
            background: tokens.ambient.dark,
          } : {},
          // Custom scrollbar
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)',
          },
          '*::-webkit-scrollbar': { width: 6 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
          '*::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
            borderRadius: 3,
          },
        },
      },
    },

    // Button
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.md,
          textTransform: 'none' as const,
          fontWeight: tokens.typography.fontWeight.medium,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        sizeLarge: { padding: '12px 24px', fontSize: tokens.typography.fontSize.base },
        sizeMedium: { padding: '8px 16px', fontSize: tokens.typography.fontSize.sm },
        sizeSmall: { padding: '6px 12px', fontSize: tokens.typography.fontSize.sm },
        contained: isDark ? {
          background: `linear-gradient(135deg, ${teal}, #00b89c)`,
          color: '#0a0e17',
          '&:hover': {
            background: `linear-gradient(135deg, #00e6c8, ${teal})`,
            boxShadow: tokens.shadows.glow,
          },
        } : {
          '&:hover': { boxShadow: tokens.shadows.sm },
        },
        outlined: isDark ? {
          borderColor: alpha(teal, 0.3),
          color: teal,
          '&:hover': {
            borderColor: teal,
            backgroundColor: alpha(teal, 0.06),
          },
        } : {},
      },
    },

    // IconButton
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.md,
          '&:hover': { backgroundColor: theme.palette.action.hover },
        },
      },
    },

    // TextField
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'medium', InputLabelProps: { shrink: true } },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.md,
          backgroundColor: isDark ? alpha('#fff', 0.02) : theme.palette.background.paper,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: isDark ? alpha(teal, 0.4) : theme.palette.primary.light,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 2,
            borderColor: theme.palette.primary.main,
          },
        },
        input: { padding: '12px 14px' },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color: theme.palette.text.secondary,
          '&.Mui-focused': { color: theme.palette.primary.main },
        },
      },
    },

    // Paper
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.lg,
          boxShadow: tokens.shadows.sm,
          backgroundImage: 'none',
          ...(isDark && {
            backgroundColor: tokens.colorsDark.background.paper,
            border: `1px solid rgba(255,255,255,0.06)`,
          }),
        },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: tokens.shadows.sm },
        elevation2: { boxShadow: tokens.shadows.md },
        elevation3: { boxShadow: tokens.shadows.lg },
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
          transition: 'all 0.25s ease',
          ...(isDark && {
            backgroundColor: tokens.colorsDark.background.paper,
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.12)',
              backgroundColor: tokens.colorsDark.background.subtle,
            },
          }),
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
        root: { borderCollapse: 'separate', borderSpacing: 0 },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
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
        head: isDark ? {
          fontWeight: tokens.typography.fontWeight.semibold,
          fontSize: '11px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.5px',
          color: tokens.colorsDark.text.disabled,
          borderBottom: `2px solid ${theme.palette.divider}`,
        } : {
          fontWeight: tokens.typography.fontWeight.semibold,
          color: theme.palette.text.primary,
          fontSize: tokens.typography.fontSize.sm,
          borderBottom: `2px solid ${theme.palette.divider}`,
        },
        body: { color: theme.palette.text.primary },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: isDark ? 'rgba(0,210,180,0.04)' : theme.palette.action.hover,
          },
          '&:last-child td': { borderBottom: 'none' },
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
        sizeSmall: { height: 24, fontSize: tokens.typography.fontSize.xs },
        sizeMedium: { height: 32, fontSize: tokens.typography.fontSize.sm },
        ...(isDark && {
          colorPrimary: {
            backgroundColor: tealDim,
            color: teal,
            border: `1px solid ${alpha(teal, 0.2)}`,
          },
          colorSuccess: {
            backgroundColor: tealDim,
            color: teal,
            border: `1px solid ${alpha(teal, 0.2)}`,
          },
          colorWarning: {
            backgroundColor: tokens.accent.amberDim,
            color: tokens.accent.amber,
            border: `1px solid ${alpha(tokens.accent.amber, 0.2)}`,
          },
          colorError: {
            backgroundColor: tokens.accent.redDim,
            color: tokens.accent.red,
            border: `1px solid ${alpha(tokens.accent.red, 0.2)}`,
          },
          colorInfo: {
            backgroundColor: tokens.accent.blueDim,
            color: tokens.accent.blue,
            border: `1px solid ${alpha(tokens.accent.blue, 0.2)}`,
          },
        }),
      },
    },

    // AppBar
    MuiAppBar: {
      styleOverrides: {
        root: isDark ? {
          backgroundColor: alpha(tokens.colorsDark.background.paper, 0.85),
          backdropFilter: 'blur(20px)',
          boxShadow: 'none',
          color: theme.palette.text.primary,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        } : {
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
        paper: isDark ? {
          backgroundColor: 'rgba(6, 9, 15, 0.95)',
          backgroundImage: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          borderRight: 'none',
        } : {
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
          '&.Mui-selected': isDark ? {
            backgroundColor: tealDim,
            color: teal,
            border: `1px solid ${alpha(teal, 0.2)}`,
            '&:hover': { backgroundColor: alpha(teal, 0.16) },
            '& .MuiListItemIcon-root': { color: teal },
          } : {
            backgroundColor: theme.palette.action.selected,
            color: theme.palette.primary.main,
            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
            '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
          },
          '&:hover': { backgroundColor: theme.palette.action.hover },
        },
      },
    },

    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 40, color: theme.palette.text.secondary },
      },
    },

    // Tabs
    MuiTabs: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${theme.palette.divider}` },
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
          ...(isDark && { backgroundColor: teal }),
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: tokens.typography.fontWeight.medium,
          fontSize: tokens.typography.fontSize.sm,
          minHeight: 48,
          '&.Mui-selected': {
            color: isDark ? teal : theme.palette.primary.main,
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
        ...(isDark ? {
          standardSuccess: {
            backgroundColor: tealDim,
            color: teal,
            border: `1px solid ${alpha(teal, 0.2)}`,
          },
          standardError: {
            backgroundColor: tokens.accent.redDim,
            color: tokens.accent.red,
            border: `1px solid ${alpha(tokens.accent.red, 0.2)}`,
          },
          standardWarning: {
            backgroundColor: tokens.accent.amberDim,
            color: tokens.accent.amber,
            border: `1px solid ${alpha(tokens.accent.amber, 0.2)}`,
          },
          standardInfo: {
            backgroundColor: tokens.accent.blueDim,
            color: tokens.accent.blue,
            border: `1px solid ${alpha(tokens.accent.blue, 0.2)}`,
          },
        } : {
          standardSuccess: { backgroundColor: tokens.colors.success.light, color: tokens.colors.success.dark },
          standardError: { backgroundColor: tokens.colors.error.light, color: tokens.colors.error.dark },
          standardWarning: { backgroundColor: tokens.colors.warning.light, color: tokens.colors.warning.dark },
          standardInfo: { backgroundColor: tokens.colors.info.light, color: tokens.colors.info.dark },
        }),
      },
    },

    // Dialog
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: tokens.borderRadius.lg,
          boxShadow: tokens.shadows.xl,
          backgroundImage: 'none',
          ...(isDark && {
            backgroundColor: tokens.colorsDark.background.paper,
            border: '1px solid rgba(255,255,255,0.08)',
          }),
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
      styleOverrides: { root: { padding: '24px' } },
    },

    MuiDialogActions: {
      styleOverrides: { root: { padding: '16px 24px', gap: '8px' } },
    },

    // Menu / Popover
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          ...(isDark && {
            backgroundColor: tokens.colorsDark.background.subtle,
            border: '1px solid rgba(255,255,255,0.08)',
          }),
        },
      },
    },

    MuiPopover: {
      styleOverrides: {
        paper: isDark ? {
          backgroundColor: tokens.colorsDark.background.subtle,
          border: '1px solid rgba(255,255,255,0.08)',
        } : {},
      },
    },

    // Tooltip
    MuiTooltip: {
      styleOverrides: {
        tooltip: isDark ? {
          backgroundColor: tokens.colorsDark.background.subtle,
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.colorsDark.text.primary,
        } : {},
      },
    },

    // Skeleton
    MuiSkeleton: {
      styleOverrides: {
        root: isDark ? { backgroundColor: 'rgba(255,255,255,0.06)' } : {},
      },
    },

    // Switch
    MuiSwitch: {
      styleOverrides: {
        switchBase: isDark ? {
          '&.Mui-checked': { color: teal },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: alpha(teal, 0.4) },
        } : {},
      },
    },

    // Fab
    MuiFab: {
      styleOverrides: {
        root: isDark ? {
          background: `linear-gradient(135deg, ${teal}, #00b89c)`,
          color: '#0a0e17',
          '&:hover': {
            background: `linear-gradient(135deg, #00e6c8, ${teal})`,
            boxShadow: tokens.shadows.glow,
          },
        } : {},
      },
    },
  };
};

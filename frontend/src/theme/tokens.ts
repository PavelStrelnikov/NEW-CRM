/**
 * Design Tokens - Modern CRM 2026
 * Clean, professional, RTL-friendly
 */

export const tokens = {
  // Color Palette
  colors: {
    // Primary - Professional blue
    primary: {
      50: '#E3F2FD',
      100: '#BBDEFB',
      200: '#90CAF9',
      300: '#64B5F6',
      400: '#42A5F5',
      500: '#2196F3', // main
      600: '#1E88E5', // hover
      700: '#1976D2',
      800: '#1565C0',
      900: '#0D47A1',
    },

    // Neutral - Grays for text/backgrounds
    neutral: {
      50: '#FAFAFA',   // bg-subtle
      100: '#F5F5F5',  // bg-light
      200: '#EEEEEE',  // border-light
      300: '#E0E0E0',  // border
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',  // text-secondary
      800: '#424242',
      900: '#212121',  // text-primary
    },

    // Semantic colors
    success: {
      main: '#10B981',
      light: '#D1FAE5',
      dark: '#065F46',
    },
    warning: {
      main: '#F59E0B',
      light: '#FEF3C7',
      dark: '#92400E',
    },
    error: {
      main: '#EF4444',
      light: '#FEE2E2',
      dark: '#991B1B',
    },
    info: {
      main: '#3B82F6',
      light: '#DBEAFE',
      dark: '#1E40AF',
    },

    // Background (Light)
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
      subtle: '#F5F5F5',
    },

    // Text (Light)
    text: {
      primary: '#212121',
      secondary: '#616161',
      disabled: '#9E9E9E',
    },

    // Borders (Light)
    border: {
      light: '#F5F5F5',
      main: '#E0E0E0',
      dark: '#BDBDBD',
    },
  },

  // Dark Theme Colors
  colorsDark: {
    // Background (Dark) - Slightly blue-tinted, more vibrant
    background: {
      default: '#0E1116',
      paper: '#141A22',
      subtle: '#1A2129',
    },

    // Text (Dark) - Higher contrast, more readable
    text: {
      primary: 'rgba(255, 255, 255, 0.92)',
      secondary: 'rgba(255, 255, 255, 0.68)',
      disabled: 'rgba(255, 255, 255, 0.38)',
    },

    // Borders (Dark) - More visible
    border: {
      light: 'rgba(255, 255, 255, 0.06)',
      main: 'rgba(255, 255, 255, 0.10)',
      dark: 'rgba(255, 255, 255, 0.14)',
    },
  },

  // Typography Scale (1.25 ratio)
  typography: {
    fontFamily: {
      base: '"Rubik", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      mono: '"Fira Code", "Consolas", "Monaco", monospace',
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
      '5xl': '48px',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Spacing (4px base)
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
  },

  // Border Radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  // Shadows (subtle, modern)
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Z-index
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
};

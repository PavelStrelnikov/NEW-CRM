/**
 * Design Tokens — CRM Surveillance Command Center 2026
 * Dark-first, teal accent, RTL-friendly
 */

export const tokens = {
  // Accent Colors
  accent: {
    teal: '#00d2b4',
    tealDim: 'rgba(0, 210, 180, 0.12)',
    blue: '#6ba1ff',
    blueDim: 'rgba(107, 161, 255, 0.12)',
    red: '#ff4d6a',
    redDim: 'rgba(255, 77, 106, 0.12)',
    amber: '#ffb347',
    amberDim: 'rgba(255, 179, 71, 0.12)',
    purple: '#c084fc',
    purpleDim: 'rgba(192, 132, 252, 0.12)',
  },

  // Color Palette (Light — kept for toggle)
  colors: {
    primary: {
      50: '#E0F7F3',
      100: '#B3ECE2',
      200: '#80E0CF',
      300: '#4DD4BC',
      400: '#26CBAD',
      500: '#00C291',    // light primary (teal-derived)
      600: '#00B085',
      700: '#009B74',
      800: '#008764',
      900: '#006548',
    },
    neutral: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#EEEEEE',
      300: '#E0E0E0',
      400: '#BDBDBD',
      500: '#9E9E9E',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    success: { main: '#00d2b4', light: '#E0F7F3', dark: '#006548' },
    warning: { main: '#ffb347', light: '#FFF3E0', dark: '#92400E' },
    error:   { main: '#ff4d6a', light: '#FFE0E6', dark: '#991B1B' },
    info:    { main: '#6ba1ff', light: '#E3EDFF', dark: '#1E40AF' },
    background: { default: '#FAFAFA', paper: '#FFFFFF', subtle: '#F5F5F5' },
    text:       { primary: '#212121', secondary: '#616161', disabled: '#9E9E9E' },
    border:     { light: '#F5F5F5', main: '#E0E0E0', dark: '#BDBDBD' },
  },

  // Dark Theme Colors
  colorsDark: {
    background: {
      default: '#0a0e17',
      paper: '#111720',
      subtle: '#161d28',
    },
    text: {
      primary: '#e4e8f1',
      secondary: '#8892a8',
      disabled: '#505a70',
    },
    border: {
      light: 'rgba(255, 255, 255, 0.04)',
      main: 'rgba(255, 255, 255, 0.08)',
      dark: 'rgba(255, 255, 255, 0.14)',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      base: '"Heebo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"IBM Plex Mono", "Fira Code", "Consolas", monospace',
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
      black: 900,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Spacing (4px base)
  spacing: {
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20,
    6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80,
  },

  // Border Radius
  borderRadius: {
    none: 0,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },

  // Shadows (dark-optimized)
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.25), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
    glow: '0 0 20px rgba(0, 210, 180, 0.15)',
  },

  // Ambient gradients
  ambient: {
    dark: 'radial-gradient(ellipse 80% 50% at 20% 10%, rgba(0,210,180,0.04) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(56,120,255,0.03) 0%, transparent 50%)',
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

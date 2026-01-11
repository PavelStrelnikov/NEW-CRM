/**
 * MUI Theme Configuration
 * Modern CRM 2026 - Clean, professional, RTL-friendly
 */

import { createTheme, Theme } from '@mui/material/styles';
import { tokens } from './theme/tokens';
import { createComponentOverrides } from './theme/overrides';

export const createAppTheme = (
  direction: 'ltr' | 'rtl',
  mode: 'light' | 'dark' = 'light'
): Theme => {
  const isDark = mode === 'dark';
  const themeColors = isDark ? tokens.colorsDark : tokens.colors;

  const baseTheme = createTheme({
    direction,
    palette: {
      mode,
      primary: {
        main: isDark ? '#4C8DFF' : tokens.colors.primary[500],
        light: isDark ? '#8AB4FF' : tokens.colors.primary[300],
        dark: isDark ? '#3B7CFF' : tokens.colors.primary[700],
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: tokens.colors.neutral[700],
        light: tokens.colors.neutral[500],
        dark: tokens.colors.neutral[900],
        contrastText: '#FFFFFF',
      },
      success: {
        main: tokens.colors.success.main,
        light: tokens.colors.success.light,
        dark: tokens.colors.success.dark,
      },
      warning: {
        main: tokens.colors.warning.main,
        light: tokens.colors.warning.light,
        dark: tokens.colors.warning.dark,
      },
      error: {
        main: tokens.colors.error.main,
        light: tokens.colors.error.light,
        dark: tokens.colors.error.dark,
      },
      info: {
        main: tokens.colors.info.main,
        light: tokens.colors.info.light,
        dark: tokens.colors.info.dark,
      },
      background: {
        default: themeColors.background.default,
        paper: themeColors.background.paper,
      },
      text: {
        primary: themeColors.text.primary,
        secondary: themeColors.text.secondary,
        disabled: themeColors.text.disabled,
      },
      divider: themeColors.border.main,
      action: {
        hover: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        selected: isDark ? 'rgba(76, 141, 255, 0.12)' : 'rgba(33, 150, 243, 0.08)',
      },
    },
    typography: {
      fontFamily: tokens.typography.fontFamily.base,
      fontSize: 16,
      fontWeightLight: tokens.typography.fontWeight.light,
      fontWeightRegular: tokens.typography.fontWeight.normal,
      fontWeightMedium: tokens.typography.fontWeight.medium,
      fontWeightBold: tokens.typography.fontWeight.bold,
      h1: {
        fontSize: tokens.typography.fontSize['5xl'],
        fontWeight: tokens.typography.fontWeight.bold,
        lineHeight: tokens.typography.lineHeight.tight,
      },
      h2: {
        fontSize: tokens.typography.fontSize['4xl'],
        fontWeight: tokens.typography.fontWeight.bold,
        lineHeight: tokens.typography.lineHeight.tight,
      },
      h3: {
        fontSize: tokens.typography.fontSize['3xl'],
        fontWeight: tokens.typography.fontWeight.semibold,
        lineHeight: tokens.typography.lineHeight.tight,
      },
      h4: {
        fontSize: tokens.typography.fontSize['2xl'],
        fontWeight: tokens.typography.fontWeight.semibold,
        lineHeight: tokens.typography.lineHeight.tight,
      },
      h5: {
        fontSize: tokens.typography.fontSize.xl,
        fontWeight: tokens.typography.fontWeight.semibold,
        lineHeight: tokens.typography.lineHeight.tight,
      },
      h6: {
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.semibold,
        lineHeight: tokens.typography.lineHeight.tight,
      },
      body1: {
        fontSize: tokens.typography.fontSize.base,
        lineHeight: tokens.typography.lineHeight.normal,
      },
      body2: {
        fontSize: tokens.typography.fontSize.sm,
        lineHeight: tokens.typography.lineHeight.normal,
      },
      button: {
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.medium,
        textTransform: 'none',
      },
      caption: {
        fontSize: tokens.typography.fontSize.xs,
        lineHeight: tokens.typography.lineHeight.normal,
      },
    },
    spacing: (factor: number) => tokens.spacing[1] * factor,
    shape: {
      borderRadius: tokens.borderRadius.md,
    },
    shadows: [
      'none',
      tokens.shadows.xs,
      tokens.shadows.sm,
      tokens.shadows.md,
      tokens.shadows.lg,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
      tokens.shadows.xl,
    ],
  });

  // Apply component overrides
  baseTheme.components = createComponentOverrides(baseTheme);

  return baseTheme;
};

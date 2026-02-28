/**
 * useResponsive - Централизованный хук для responsive breakpoints
 *
 * Логика определения устройства:
 * - Mobile: ширина < 600px ИЛИ (ширина < 900px И portrait) - телефон в любой ориентации
 * - Tablet: 600-1023px в landscape (настоящий планшет)
 * - Desktop: >= 1024px
 *
 * Это позволяет телефону в landscape (например 740x360) оставаться в mobile режиме,
 * а не переключаться на tablet UI с sidebar.
 */
import { useTheme, useMediaQuery } from '@mui/material';

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
}

export const useResponsive = (): ResponsiveState => {
  const theme = useTheme();

  // Raw breakpoints
  const isSmallWidth = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isLargeWidth = useMediaQuery(theme.breakpoints.up('lg')); // >= 1024px

  // Orientation
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  // Phone in landscape typically has width 600-900px but height < 500px
  const isPhoneLandscape = useMediaQuery('(max-height: 500px) and (orientation: landscape)');

  // Mobile = phone in any orientation
  // - Width < 600px (always mobile)
  // - OR phone in landscape (detected by small height)
  const isMobile = isSmallWidth || isPhoneLandscape;

  // Tablet = medium device that's NOT a phone in landscape
  // Typically 600-1023px width with height > 500px
  const isTablet = !isMobile && !isLargeWidth;

  // Desktop = large screens >= 1024px
  const isDesktop = isLargeWidth;

  return {
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
  };
};

export default useResponsive;

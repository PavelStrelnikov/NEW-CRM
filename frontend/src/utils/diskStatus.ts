/**
 * Shared disk status utilities for consistent status handling
 * across AssetForm and AssetDetails components.
 */

/**
 * Disk status types matching backend values
 */
export type DiskStatus = 'ok' | 'warning' | 'error' | 'unknown';

/**
 * Check if a disk status indicates a problem (not OK/healthy).
 * Works with both raw probe statuses and normalized dropdown values.
 *
 * @param status - The disk status string
 * @returns true if the status indicates an issue
 */
export function isDiskStatusBad(status: string | undefined): boolean {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  // OK statuses (including normalized 'ok' from dropdown)
  if (statusLower === 'ok' || statusLower === 'healthy' || statusLower === 'normal') {
    return false;
  }
  // Any other status is considered bad (error, warning, unknown, smartFailed, etc.)
  return true;
}

/**
 * Check if a disk status is specifically an error (not warning).
 *
 * @param status - The disk status string
 * @returns true if the status is an error
 */
export function isDiskStatusError(status: string | undefined): boolean {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  return (
    statusLower === 'error' ||
    statusLower.includes('fail') ||
    statusLower.includes('bad') ||
    statusLower === 'smartfailed'
  );
}

/**
 * Check if a disk status is a warning (not error).
 *
 * @param status - The disk status string
 * @returns true if the status is a warning
 */
export function isDiskStatusWarning(status: string | undefined): boolean {
  if (!status) return false;
  const statusLower = status.toLowerCase();
  return (
    statusLower === 'warning' ||
    statusLower === 'degraded' ||
    statusLower === 'uninitialized'
  );
}

/**
 * Get the color for a disk status.
 * Used for consistent styling across components.
 *
 * @param status - The disk status string
 * @returns Color code for the status
 */
export function getDiskStatusColor(status: string | undefined): {
  main: string;
  background: string;
  text: string;
} {
  if (!status) {
    return { main: 'grey', background: 'transparent', text: 'inherit' };
  }

  const statusLower = status.toLowerCase();

  // Error statuses - Red
  if (
    statusLower === 'error' ||
    statusLower.includes('fail') ||
    statusLower.includes('bad') ||
    statusLower === 'smartfailed'
  ) {
    return {
      main: '#ff4d6a',
      background: 'rgba(255, 77, 106, 0.1)',
      text: '#ff4d6a',
    };
  }

  // Warning statuses - Amber
  if (
    statusLower === 'warning' ||
    statusLower === 'degraded' ||
    statusLower === 'uninitialized'
  ) {
    return {
      main: '#ffb347',
      background: 'rgba(255, 179, 71, 0.1)',
      text: '#ffb347',
    };
  }

  // OK statuses - Teal
  if (
    statusLower === 'ok' ||
    statusLower === 'healthy' ||
    statusLower === 'normal'
  ) {
    return {
      main: '#00d2b4',
      background: 'transparent',
      text: 'inherit',
    };
  }

  // Unknown/Other statuses - Grey
  return {
    main: '#505a70',
    background: 'rgba(80, 90, 112, 0.1)',
    text: '#505a70',
  };
}

/**
 * Normalize disk status from probe response to dropdown values.
 * Maps various Hikvision status strings to our standard dropdown options.
 *
 * @param probeStatus - Raw status from probe response
 * @param smartStatus - S.M.A.R.T. status if available
 * @param workingHours - Power-on hours for age-based warning
 * @returns Normalized status: 'ok' | 'warning' | 'error' | 'unknown'
 */
export function normalizeProbeStatus(
  probeStatus: string | undefined,
  smartStatus?: string,
  workingHours?: number
): DiskStatus {
  // If SMART status is Fail, always return error
  if (smartStatus === 'Fail') {
    return 'error';
  }

  // If SMART status is Warning, return warning
  if (smartStatus === 'Warning') {
    return 'warning';
  }

  // Check working hours for age-based warning (> 50,000 hours is concerning)
  if (workingHours && workingHours > 50000) {
    return 'warning';
  }

  if (!probeStatus) return 'unknown';
  const statusLower = probeStatus.toLowerCase();

  // OK/healthy statuses
  if (statusLower === 'ok' || statusLower === 'healthy' || statusLower === 'normal') {
    return 'ok';
  }

  // Error statuses (SMART failures, errors, etc.)
  if (
    statusLower.includes('error') ||
    statusLower.includes('fail') ||
    statusLower.includes('smart') ||
    statusLower === 'bad' ||
    statusLower === 'failed'
  ) {
    return 'error';
  }

  // Warning statuses
  if (
    statusLower.includes('warning') ||
    statusLower.includes('degraded') ||
    statusLower === 'uninitialized'
  ) {
    return 'warning';
  }

  // Unknown/other statuses
  return 'unknown';
}

/**
 * Get translated status label for display.
 *
 * @param status - Normalized status
 * @param t - Translation function
 * @returns Translated status label
 */
export function getDiskStatusLabel(
  status: string | undefined,
  t: (key: string) => string
): string {
  if (!status) return '-';
  const statusLower = status.toLowerCase();

  if (statusLower === 'ok' || statusLower === 'healthy' || statusLower === 'normal') {
    return t('assets.diskStatusOk');
  }
  if (statusLower === 'error' || statusLower.includes('fail') || statusLower.includes('smart')) {
    return t('assets.diskStatusError');
  }
  if (statusLower === 'warning' || statusLower === 'degraded') {
    return t('assets.diskStatusWarning');
  }
  if (statusLower === 'uninitialized') {
    return t('assets.diskStatusUninitialized');
  }
  return t('assets.diskStatusUnknown');
}

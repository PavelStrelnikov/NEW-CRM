/**
 * Generate human-readable issue descriptions from probe health issues.
 * Primary language: Hebrew (for internal tickets)
 * Secondary: English (for reference)
 */

import { HikvisionProbeResponse, HikvisionDiskInfo, HikvisionChannelDetail } from '@/types';

interface IssueDescriptionOptions {
  locale?: 'he' | 'en';
  /** @deprecated Device info is now pulled from linked asset, not included in description */
  includeDeviceInfo?: boolean;
  assetLabel?: string;
}

interface GeneratedTicketData {
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Format working hours to human-readable string
 */
const formatWorkingHours = (hours: number | undefined, locale: 'he' | 'en'): string => {
  if (!hours) return locale === 'he' ? 'לא ידוע' : 'unknown';
  const years = Math.floor(hours / 8760);
  const remainingHours = hours % 8760;

  if (years > 0) {
    return locale === 'he'
      ? `${hours.toLocaleString()} שעות (${years} שנים)`
      : `${hours.toLocaleString()} hours (${years} years)`;
  }
  return locale === 'he' ? `${hours.toLocaleString()} שעות` : `${hours.toLocaleString()} hours`;
};

/**
 * Generate title based on health status and issues
 */
const generateTitle = (
  healthStatus: string,
  issues: string[],
  locale: 'he' | 'en',
  assetLabel?: string
): string => {
  const prefix = assetLabel ? `[${assetLabel}] ` : '';

  // Check for critical disk issues first
  const hasDiskCritical = issues.some(i =>
    i.includes('SMART_FAIL') || i.includes('STATUS_ERROR')
  );

  if (hasDiskCritical) {
    return prefix + (locale === 'he'
      ? 'תקלה קריטית בדיסק קשיח - נדרש טיפול דחוף'
      : 'Critical HDD Failure - Urgent Attention Required');
  }

  // Check for device offline
  if (issues.includes('DEVICE_OFFLINE')) {
    return prefix + (locale === 'he'
      ? 'מכשיר לא מגיב - בדיקת תקשורת נדרשת'
      : 'Device Offline - Communication Check Required');
  }

  // Check for camera issues
  const cameraOffline = issues.find(i => i.startsWith('CAMERAS_OFFLINE_'));
  const noRecording = issues.find(i => i.startsWith('NO_RECORDING_24H_'));

  if (cameraOffline && noRecording) {
    return prefix + (locale === 'he'
      ? 'מצלמות לא מקוונות ובעיות הקלטה'
      : 'Cameras Offline and Recording Issues');
  }

  if (cameraOffline) {
    const count = cameraOffline.split('_').pop();
    return prefix + (locale === 'he'
      ? `${count} מצלמות לא מקוונות`
      : `${count} Cameras Offline`);
  }

  if (noRecording) {
    const count = noRecording.split('_').pop();
    return prefix + (locale === 'he'
      ? `אין הקלטה ב-${count} ערוצים`
      : `No Recording on ${count} Channels`);
  }

  // SMART warnings
  const hasSmartWarning = issues.some(i => i.includes('SMART_WARNING'));
  if (hasSmartWarning) {
    return prefix + (locale === 'he'
      ? 'אזהרת בריאות דיסק - נדרש מעקב'
      : 'Disk Health Warning - Monitoring Required');
  }

  // Generic fallback
  return prefix + (locale === 'he'
    ? 'בעיות שזוהו במערכת'
    : 'System Issues Detected');
};

/**
 * Generate detailed description from probe result
 */
const generateDescription = (
  probeResult: HikvisionProbeResponse,
  issues: string[],
  locale: 'he' | 'en',
  options: IssueDescriptionOptions
): string => {
  const lines: string[] = [];

  // Header
  lines.push(locale === 'he'
    ? '=== דו"ח בדיקת מערכת אוטומטית ==='
    : '=== Automated System Check Report ===');
  lines.push('');

  // Note: Device info (model, serial) is now pulled from the linked asset object,
  // not duplicated in the ticket description.

  // Disk Issues
  const diskIssues = issues.filter(i => i.startsWith('HDD_'));
  if (diskIssues.length > 0) {
    lines.push(locale === 'he' ? '💾 בעיות דיסקים:' : '💾 Disk Issues:');

    for (const issue of diskIssues) {
      const parts = issue.split('_');
      const slot = parts[1];
      const issueType = parts.slice(2).join('_');

      // Find disk details from probe result
      const disk = probeResult.storage?.disks?.find(d => String(d.slot) === slot);

      let issueText = '';
      if (issueType === 'SMART_FAIL') {
        issueText = locale === 'he' ? 'כשל SMART - החלפה דחופה נדרשת!' : 'SMART Failure - Urgent replacement needed!';
      } else if (issueType === 'SMART_WARNING') {
        issueText = locale === 'he' ? 'אזהרת SMART - מומלץ לתכנן החלפה' : 'SMART Warning - Plan replacement';
      } else if (issueType === 'STATUS_ERROR') {
        issueText = locale === 'he' ? 'שגיאת דיסק - בדיקה נדרשת' : 'Disk Error - Check required';
      }

      lines.push(locale === 'he'
        ? `   • דיסק ${slot}: ${issueText}`
        : `   • HDD ${slot}: ${issueText}`);

      // Add disk details if available
      if (disk) {
        const details: string[] = [];
        if (disk.serial) {
          details.push(locale === 'he' ? `סידורי: ${disk.serial}` : `Serial: ${disk.serial}`);
        }
        if (disk.working_hours) {
          details.push(locale === 'he'
            ? `זמן עבודה: ${formatWorkingHours(disk.working_hours, locale)}`
            : `Runtime: ${formatWorkingHours(disk.working_hours, locale)}`);
        }
        if (disk.temperature) {
          details.push(locale === 'he' ? `טמפ': ${disk.temperature}°C` : `Temp: ${disk.temperature}°C`);
        }
        if (details.length > 0) {
          lines.push(`     (${details.join(', ')})`);
        }
      }
    }
    lines.push('');
  }

  // Camera Issues
  const cameraOffline = issues.find(i => i.startsWith('CAMERAS_OFFLINE_'));
  const noRecording = issues.find(i => i.startsWith('NO_RECORDING_24H_'));

  if (cameraOffline || noRecording) {
    lines.push(locale === 'he' ? '📹 בעיות מצלמות:' : '📹 Camera Issues:');

    if (cameraOffline) {
      const count = cameraOffline.split('_').pop();
      const total = probeResult.cameras?.total || '?';
      lines.push(locale === 'he'
        ? `   • מצלמות לא מקוונות: ${count} מתוך ${total}`
        : `   • Cameras Offline: ${count} of ${total}`);
    }

    if (noRecording) {
      const count = noRecording.split('_').pop();
      lines.push(locale === 'he'
        ? `   • אין הקלטה ב-24 שעות אחרונות: ${count} ערוצים`
        : `   • No Recording (24h): ${count} channels`);
    }

    // List problematic channels
    const problemChannels = probeResult.cameras?.channels?.filter(
      (ch: HikvisionChannelDetail) => ch.is_configured && (!ch.is_online || !ch.has_recording_24h)
    );

    if (problemChannels && problemChannels.length > 0) {
      lines.push('');
      lines.push(locale === 'he' ? '   ערוצים בעייתיים:' : '   Problematic Channels:');
      for (const ch of problemChannels.slice(0, 10)) { // Limit to 10
        const status: string[] = [];
        if (!ch.is_online) status.push(locale === 'he' ? 'לא מקוון' : 'offline');
        if (!ch.has_recording_24h) status.push(locale === 'he' ? 'אין הקלטה' : 'no recording');

        lines.push(`   - D${ch.channel_number} ${ch.name ? `(${ch.name})` : ''}: ${status.join(', ')}`);
        if (ch.ip_address) {
          lines.push(`     IP: ${ch.ip_address}`);
        }
      }
      if (problemChannels.length > 10) {
        lines.push(locale === 'he'
          ? `   ... ועוד ${problemChannels.length - 10} ערוצים`
          : `   ... and ${problemChannels.length - 10} more channels`);
      }
    }
    lines.push('');
  }

  // Device offline
  if (issues.includes('DEVICE_OFFLINE')) {
    lines.push(locale === 'he' ? '🔴 מכשיר לא מגיב:' : '🔴 Device Offline:');
    lines.push(locale === 'he'
      ? '   המכשיר לא הגיב לבדיקה. יש לבדוק תקשורת רשת.'
      : '   Device did not respond to probe. Check network connectivity.');
    lines.push('');
  }

  // Footer with timestamp
  const now = new Date();
  lines.push('---');
  lines.push(locale === 'he'
    ? `נוצר אוטומטית ב: ${now.toLocaleString('he-IL')}`
    : `Auto-generated at: ${now.toISOString()}`);

  return lines.join('\n');
};

/**
 * Determine ticket priority based on issues
 */
const determinePriority = (issues: string[]): 'low' | 'normal' | 'high' | 'urgent' => {
  // URGENT: Device offline or SMART failure
  if (issues.includes('DEVICE_OFFLINE') || issues.some(i => i.includes('SMART_FAIL'))) {
    return 'urgent';
  }

  // HIGH: Disk errors or multiple cameras offline
  if (issues.some(i => i.includes('STATUS_ERROR'))) {
    return 'high';
  }

  const cameraOffline = issues.find(i => i.startsWith('CAMERAS_OFFLINE_'));
  if (cameraOffline) {
    const count = parseInt(cameraOffline.split('_').pop() || '0');
    if (count >= 3) return 'high';
  }

  // NORMAL: SMART warnings, some cameras offline, no recording
  if (issues.some(i => i.includes('SMART_WARNING'))) {
    return 'normal';
  }

  return 'normal';
};

/**
 * Main function to generate ticket data from probe result
 */
export const generateTicketFromProbe = (
  probeResult: HikvisionProbeResponse,
  healthStatus: string,
  issues: string[],
  options: IssueDescriptionOptions = {}
): GeneratedTicketData => {
  const locale = options.locale || 'he';

  return {
    title: generateTitle(healthStatus, issues, locale, options.assetLabel),
    description: generateDescription(probeResult, issues, locale, options),
    priority: determinePriority(issues),
  };
};

export default generateTicketFromProbe;

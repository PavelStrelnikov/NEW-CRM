/**
 * Circular health gauge for NVR/DVR asset detail page.
 * SVG-based donut chart with status bars below.
 */

import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { HealthStatus } from '@/types';
import { MONO_FONT } from './shared/AssetFieldComponents';

interface HealthGaugeProps {
  status: HealthStatus;
  channelsOnline?: number;
  channelsTotal?: number;
  recordingOk?: number;
  recordingTotal?: number;
  diskTemp?: number | null;
  uptimeDisplay?: string | null;
}

const STATUS_COLORS: Record<HealthStatus, string> = {
  ok: '#00d2b4',
  warning: '#ffb347',
  critical: '#ff4d6a',
  unknown: '#505a70',
};

function calculatePercent(
  status: HealthStatus,
  channelsOnline?: number,
  channelsTotal?: number,
  recordingOk?: number,
  recordingTotal?: number,
): number {
  if (status === 'unknown') return 0;
  if (status === 'ok') return 100;
  if (status === 'critical') return 20;

  // warning: weighted average of channel + recording health
  const channelPct = channelsTotal && channelsTotal > 0
    ? (channelsOnline || 0) / channelsTotal * 100
    : 50;
  const recordPct = recordingTotal && recordingTotal > 0
    ? (recordingOk || 0) / recordingTotal * 100
    : 50;
  return Math.round((channelPct + recordPct) / 2);
}

export const HealthGauge: React.FC<HealthGaugeProps> = ({
  status,
  channelsOnline,
  channelsTotal,
  recordingOk,
  recordingTotal,
  diskTemp,
  uptimeDisplay,
}) => {
  const { t } = useTranslation();

  const percent = calculatePercent(status, channelsOnline, channelsTotal, recordingOk, recordingTotal);
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;

  // SVG circle math
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  const statusLabels: Record<HealthStatus, string> = {
    ok: t('assets.excellentCondition', '\u05DE\u05E6\u05D1 \u05DE\u05E6\u05D5\u05D9\u05DF'),
    warning: t('assets.warningCondition', '\u05E0\u05D3\u05E8\u05E9\u05EA \u05EA\u05E9\u05D5\u05DE\u05EA \u05DC\u05D1'),
    critical: t('assets.criticalCondition', '\u05DE\u05E6\u05D1 \u05E7\u05E8\u05D9\u05D8\u05D9'),
    unknown: t('assets.unknownCondition', '\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2'),
  };

  const channelPct = channelsTotal && channelsTotal > 0
    ? Math.round((channelsOnline || 0) / channelsTotal * 100)
    : 0;
  const recordPct = recordingTotal && recordingTotal > 0
    ? Math.round((recordingOk || 0) / recordingTotal * 100)
    : 0;

  return (
    <Box sx={{ textAlign: 'center' }}>
      {/* Donut gauge */}
      <Box sx={{ position: 'relative', width: 150, height: 150, mx: 'auto', mb: 1.5 }}>
        <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        {/* Center text */}
        <Box sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Typography
            sx={{
              fontFamily: MONO_FONT,
              fontWeight: 700,
              fontSize: '1.75rem',
              lineHeight: 1,
              color,
            }}
          >
            {percent}%
          </Typography>
        </Box>
      </Box>

      {/* Status label */}
      <Typography
        sx={{
          fontWeight: 600,
          fontSize: '0.875rem',
          color,
          mb: 2,
        }}
      >
        {statusLabels[status]}
      </Typography>

      {/* Stat bars */}
      <Box sx={{ textAlign: 'start', px: 1 }}>
        {/* Channels */}
        {channelsTotal != null && channelsTotal > 0 && (
          <StatBar
            label={t('assets.channelsLabel', '\u05E2\u05E8\u05D5\u05E6\u05D9\u05DD')}
            value={`${channelsOnline || 0}/${channelsTotal}`}
            percent={channelPct}
            color={channelPct >= 100 ? '#00d2b4' : channelPct > 50 ? '#ffb347' : '#ff4d6a'}
          />
        )}

        {/* Recording */}
        {recordingTotal != null && recordingTotal > 0 && (
          <StatBar
            label={t('assets.recordingLabel', '\u05D4\u05E7\u05DC\u05D8\u05D4')}
            value={`${recordingOk || 0}/${recordingTotal}`}
            percent={recordPct}
            color={recordPct >= 100 ? '#00d2b4' : recordPct > 50 ? '#ffb347' : '#ff4d6a'}
          />
        )}

        {/* Disk temp */}
        {diskTemp != null && (
          <StatBar
            label={t('assets.diskLabel', '\u05D3\u05D9\u05E1\u05E7')}
            value={`${diskTemp}\u00B0C`}
            percent={Math.min(100, Math.max(0, 100 - (diskTemp - 30) * 3))}
            color={diskTemp <= 45 ? '#00d2b4' : diskTemp <= 55 ? '#ffb347' : '#ff4d6a'}
          />
        )}

        {/* Uptime */}
        {uptimeDisplay && (
          <StatBar
            label="Uptime"
            value={uptimeDisplay}
            percent={100}
            color="#6ba1ff"
          />
        )}
      </Box>
    </Box>
  );
};

const StatBar: React.FC<{
  label: string;
  value: string;
  percent: number;
  color: string;
}> = ({ label, value, percent, color }) => (
  <Box sx={{ mb: 1.25 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.25 }}>
      <Typography
        sx={{
          fontFamily: MONO_FONT,
          fontSize: '0.8rem',
          fontWeight: 600,
          color,
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
        {label}
      </Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={percent}
      sx={{
        height: 4,
        borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.06)',
        '& .MuiLinearProgress-bar': {
          bgcolor: color,
          borderRadius: 2,
        },
      }}
    />
  </Box>
);

export default HealthGauge;

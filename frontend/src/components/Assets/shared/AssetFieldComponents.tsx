/**
 * Shared presentational components for asset detail views.
 * Used by AssetDetails, NVRDetailsView, RouterDetailsView,
 * AccessPointDetailsView, SwitchDetailsView.
 */

import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

/** Monospace font stack for technical data */
export const MONO_FONT = '"SF Mono", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace';

/** Compact field for technical info display */
export const CompactField: React.FC<{
  label: string;
  value: React.ReactNode;
  monospace?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
  ltr?: boolean;
  truncate?: boolean;
  maxWidth?: number | string;
}> = ({ label, value, monospace, copyable, onCopy, ltr, truncate = true, maxWidth }) => (
  <Box sx={{ minWidth: 0, maxWidth }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        display: 'block',
        lineHeight: 1.2,
        mb: 0.25,
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
      <Typography
        variant="body2"
        dir={ltr || monospace ? 'ltr' : undefined}
        sx={{
          fontFamily: monospace ? MONO_FONT : 'inherit',
          fontWeight: 500,
          fontSize: '0.9375rem',
          lineHeight: 1.4,
          ...(truncate && {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }),
          textAlign: ltr || monospace ? 'left' : undefined,
        }}
      >
        {value || '\u2014'}
      </Typography>
      {copyable && value && onCopy && (
        <Tooltip title="Copy">
          <IconButton size="small" onClick={onCopy} sx={{ p: 0.25, ml: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  </Box>
);

/** Secret field with visibility toggle and copy button */
export const SecretField: React.FC<{
  label: string;
  value: string | null | undefined;
  fieldKey: string;
  visibleSecrets: Set<string>;
  toggleSecretVisibility: (key: string) => void;
  handleCopy: (text: string) => void;
}> = ({ label, value, fieldKey, visibleSecrets, toggleSecretVisibility, handleCopy }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Typography
        variant="body2"
        dir="ltr"
        sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: '0.9375rem', textAlign: 'left' }}
      >
        {value ? (visibleSecrets.has(fieldKey) ? value : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022') : '\u2014'}
      </Typography>
      {value && (
        <>
          <IconButton size="small" onClick={() => toggleSecretVisibility(fieldKey)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
            {visibleSecrets.has(fieldKey) ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
          </IconButton>
          <IconButton size="small" onClick={() => handleCopy(value)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </>
      )}
    </Box>
  </Box>
);

/** Truncated serial number with tooltip showing full value */
export const TruncatedSerial: React.FC<{
  serial: string | null | undefined;
  onCopy: () => void;
}> = ({ serial, onCopy }) => {
  if (!serial) return <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>{'\u2014'}</Typography>;

  const truncated = serial.length > 14
    ? `${serial.slice(0, 6)}\u2026${serial.slice(-6)}`
    : serial;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip title={serial} placement="top">
        <Typography
          variant="body2"
          dir="ltr"
          sx={{
            fontFamily: MONO_FONT,
            fontWeight: 500,
            fontSize: '0.9375rem',
            cursor: 'help',
          }}
        >
          {truncated}
        </Typography>
      </Tooltip>
      <Tooltip title="Copy full serial">
        <IconButton size="small" onClick={onCopy} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
          <ContentCopyIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

/** Card section header with icon, title, and optional action */
export const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  color?: string;
}> = ({ icon, title, action, color = 'primary.main' }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    mb: 1,
    pb: 0.75,
    borderBottom: '1px solid',
    borderColor: 'divider',
  }}>
    <Box sx={{ color, display: 'flex', alignItems: 'center' }}>
      {icon}
    </Box>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
      {title}
    </Typography>
    {action}
  </Box>
);

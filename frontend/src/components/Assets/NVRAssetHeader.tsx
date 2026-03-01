/**
 * NVR "Command Center" header card — large, dark, prominent.
 */

import React from 'react';
import { Box, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import WarningIcon from '@mui/icons-material/Warning';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { MONO_FONT, TruncatedSerial } from './shared/AssetFieldComponents';
import { HealthStatusIcon } from './HealthStatusIcon';
import type { AssetDetailResponse, HealthStatus } from '@/types';

interface NVRAssetHeaderProps {
  asset: AssetDetailResponse;
  assetTypeName: string;
  hasDiskIssues: boolean;
  onNavigateTicket?: (ticketId: string) => void;
  onCopySerial: () => void;
  ticketsBasePath: string;
}

export const NVRAssetHeader: React.FC<NVRAssetHeaderProps> = ({
  asset,
  assetTypeName,
  hasDiskIssues,
  onNavigateTicket,
  onCopySerial,
  ticketsBasePath,
}) => {
  const { t } = useTranslation();

  const healthStatus = (asset.health_status as HealthStatus) || 'unknown';

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        border: '1px solid',
        borderColor: 'rgba(0, 210, 180, 0.15)',
        boxShadow: '0 0 20px rgba(0, 210, 180, 0.08)',
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}>
          {/* Right side (RTL): Device info */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flex: 1, minWidth: 0 }}>
            {/* Device icon */}
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '14px',
                bgcolor: 'rgba(0, 210, 180, 0.08)',
                border: '1px solid rgba(0, 210, 180, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <StorageIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>

            {/* Name + model + chips */}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {/* Device label - large monospace */}
              <Typography
                variant="h4"
                sx={{
                  fontFamily: MONO_FONT,
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', sm: '2rem' },
                  lineHeight: 1.1,
                  mb: 0.5,
                }}
              >
                {asset.label}
              </Typography>

              {/* Model info line */}
              <Typography
                variant="body2"
                color="text.secondary"
                dir="ltr"
                sx={{
                  fontFamily: MONO_FONT,
                  fontSize: '0.8rem',
                  mb: 1,
                  textAlign: 'left',
                }}
              >
                {[
                  asset.serial_number && (asset.serial_number.length > 14
                    ? `${asset.serial_number.slice(0, 6)}\u2026${asset.serial_number.slice(-8)}`
                    : asset.serial_number),
                  asset.manufacturer,
                  asset.model,
                ].filter(Boolean).join(' \u00B7 ')}
              </Typography>

              {/* Chips row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <HealthStatusIcon
                  status={healthStatus}
                  issues={asset.health_issues}
                  size="small"
                />
                <Chip
                  label={assetTypeName}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
                <Chip
                  icon={<FiberManualRecordIcon sx={{ fontSize: '8px !important' }} />}
                  label={
                    asset.status === 'active' ? t('assets.statusActive') :
                    asset.status === 'in_repair' ? t('assets.statusInRepair') :
                    asset.status === 'inactive' ? t('assets.statusInactive') :
                    asset.status
                  }
                  size="small"
                  color={
                    asset.status === 'active' ? 'success' :
                    asset.status === 'in_repair' ? 'warning' :
                    'default'
                  }
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
                {asset.has_active_ticket && asset.tickets && asset.tickets.length > 0 && (
                  <Tooltip title={t('assets.hasActiveTicket')}>
                    <Chip
                      icon={<ConfirmationNumberIcon sx={{ fontSize: 14 }} />}
                      label={t('assets.activeTicket')}
                      size="small"
                      color="info"
                      onClick={() => {
                        const activeTicket = asset.tickets?.find((tk: any) => !tk.is_closed);
                        if (activeTicket && onNavigateTicket) onNavigateTicket(activeTicket.id);
                      }}
                      sx={{ height: 24, fontSize: '0.75rem', cursor: 'pointer' }}
                    />
                  </Tooltip>
                )}
                {hasDiskIssues && (
                  <Chip
                    icon={<WarningIcon sx={{ fontSize: 14 }} />}
                    label={t('assets.diskStatusError')}
                    size="small"
                    color="error"
                    sx={{ height: 24, fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          {/* Left side (RTL): Install date */}
          <Box sx={{
            textAlign: { xs: 'start', sm: 'end' },
            flexShrink: 0,
          }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}
            >
              {t('assets.installDate')}
            </Typography>
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontWeight: 600,
                fontSize: '1.25rem',
                lineHeight: 1.3,
              }}
            >
              {asset.install_date ? format(new Date(asset.install_date), 'dd/MM/yyyy') : '\u2014'}
            </Typography>
          </Box>
        </Box>

        {/* Notes */}
        {asset.notes && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {t('assets.notes')}:
            </Typography>
            <Typography variant="body2" component="span" sx={{ ml: 0.5, fontSize: '0.9rem' }}>
              {asset.notes}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default NVRAssetHeader;

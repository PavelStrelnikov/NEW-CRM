/**
 * NVR Details View - "Surveillance Command Center" layout.
 *
 * Full-width card grid replacing the NVR properties tab in AssetDetails.
 * Row 1: Network & Connection (8/12) + Quick Actions (4/12)
 * Row 2: Health Gauge (4/12) + Credentials (4/12) + System Specs (4/12)
 * Row 3: Storage / HDD Table (full width)
 * Row 4: Channel Status (full width) - visual camera card grid + edit mode table fallback
 * Row 5: Additional Properties (if any) + Recent Activity timeline (if events)
 */

import React from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip, Tooltip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Checkbox, Divider, CircularProgress, IconButton,
} from '@mui/material';
import RouterIcon from '@mui/icons-material/Router';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import WarningIcon from '@mui/icons-material/Warning';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HistoryIcon from '@mui/icons-material/History';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useTranslation } from 'react-i18next';
import { CompactField, SecretField, SectionHeader, MONO_FONT } from './shared/AssetFieldComponents';
import { HealthGauge } from './HealthGauge';
import { isDiskStatusBad, getDiskStatusLabel } from '@/utils/diskStatus';
import { formatRuntime, formatTemperature } from '@/utils/formatters';
import type { AssetDetailResponse, AssetProperty, ChannelWithStatus, HealthStatus, NVRChannelBulkUpdate } from '@/types';
import { format } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

interface NVRDetailsViewProps {
  asset: AssetDetailResponse;
  getProp: (key: string) => any;
  visibleSecrets: Set<string>;
  toggleSecretVisibility: (key: string) => void;
  handleCopy: (text: string) => void;
  // Network
  webUiUrl: string | null;
  // Channels
  channels?: ChannelWithStatus[];
  channelEditMode: boolean;
  channelEdits: Map<number, NVRChannelBulkUpdate>;
  onEditChannelsClick: () => void;
  onCancelChannelEdits: () => void;
  onSaveChannels: () => void;
  onChannelFieldChange: (channelNumber: number, field: string, value: any) => void;
  channelUpdatePending: boolean;
  // Disks
  disks?: any[];
  hasDiskIssues: boolean;
  probePending: boolean;
  // Actions
  canProbe: boolean;
  onProbeDevice: () => void;
  shouldShowServiceTicketButton: boolean;
  onOpenServiceTicket: () => void;
  hasTimeDrift: boolean;
  onTimeSyncClick: () => void;
  healthStatus: HealthStatus;
  // Snapshots
  onSnapshotClick: (channelNum: number) => void;
  isPortalUser: boolean;
  // Events (for Recent Activity)
  events?: any[];
  // Remaining properties
  remainingProperties: AssetProperty[];
  // Locale
  locale: string;
}

// ============================================================================
// CARD STYLE CONSTANT
// ============================================================================

const CARD_CONTENT_SX = { py: 1, px: 1.5, '&:last-child': { pb: 1 } };

// ============================================================================
// EVENT TYPE LABELS
// ============================================================================

const EVENT_TYPE_LABELS: Record<string, string> = {
  probe: 'Probe',
  password_change: 'Password Change',
  channel_update: 'Channel Update',
  disk_added: 'Disk Added',
  disk_removed: 'Disk Removed',
  created: 'Created',
  updated: 'Updated',
  time_sync: 'Time Sync',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const NVRDetailsView: React.FC<NVRDetailsViewProps> = ({
  asset: _asset,
  getProp,
  visibleSecrets,
  toggleSecretVisibility,
  handleCopy,
  webUiUrl,
  channels,
  channelEditMode,
  channelEdits,
  onEditChannelsClick,
  onCancelChannelEdits,
  onSaveChannels,
  onChannelFieldChange,
  channelUpdatePending,
  disks,
  hasDiskIssues,
  probePending,
  canProbe,
  onProbeDevice,
  shouldShowServiceTicketButton,
  onOpenServiceTicket,
  hasTimeDrift,
  onTimeSyncClick,
  healthStatus,
  onSnapshotClick,
  isPortalUser,
  events,
  remainingProperties,
  locale,
}) => {
  const { t } = useTranslation();

  // Channel summary stats
  const configuredChannels = channels?.filter(ch => ch.is_configured && !ch.is_ignored) || [];
  const onlineCount = configuredChannels.filter(ch => ch.is_online).length;
  const totalConfigured = configuredChannels.length;
  const recordingOkCount = configuredChannels.filter(ch => ch.has_recording_24h).length;

  // Max disk temperature for health gauge
  const maxDiskTemp = disks?.reduce((max: number | null, d: any) => {
    if (d.temperature == null) return max;
    return max == null ? d.temperature : Math.max(max, d.temperature);
  }, null) ?? null;

  // Uptime display
  const uptimeHours = getProp('uptime_hours');
  const uptimeDisplay = uptimeHours != null ? formatRuntime(uptimeHours, locale) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ==================================================================
          ROW 1: Network & Connection (8/12) + Quick Actions (4/12)
          ================================================================== */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
        gap: 1.5,
      }}>
        {/* ── Network & Connection Card ──────────────────────────────── */}
        <Card variant="outlined">
          <CardContent sx={CARD_CONTENT_SX}>
            <SectionHeader
              icon={<RouterIcon sx={{ fontSize: 18 }} />}
              title={t('assets.networkConnection', 'Network & Connection')}
              action={
                webUiUrl ? (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip
                      label={getProp('wan_proto')?.toUpperCase() || 'HTTP'}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem', fontFamily: MONO_FONT }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                      onClick={() => window.open(webUiUrl, '_blank')}
                      sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}
                    >
                      Web UI
                    </Button>
                  </Stack>
                ) : undefined
              }
            />

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}>
              {/* WAN Subsection */}
              <Box sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 1,
                p: 1.25,
              }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mb: 1,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'info.main',
                    letterSpacing: '0.05em',
                  }}
                >
                  WAN / {t('assets.externalAccess', 'external access')}
                </Typography>

                <CompactField
                  label={t('assets.ipAddress', 'IP Address')}
                  value={getProp('wan_public_ip')}
                  monospace
                  copyable
                  onCopy={() => handleCopy(getProp('wan_public_ip') || '')}
                  ltr
                />

                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 1,
                  mt: 1,
                }}>
                  <CompactField
                    label={t('assets.protocol', 'Protocol')}
                    value={getProp('wan_proto')?.toUpperCase() || 'HTTP'}
                    monospace
                  />
                  <CompactField
                    label={t('assets.webPort', 'Web Port')}
                    value={getProp('wan_http_port') || '80'}
                    monospace
                  />
                  <CompactField
                    label={t('assets.servicePort', 'Service Port')}
                    value={getProp('wan_service_port') || '8000'}
                    monospace
                  />
                </Box>
              </Box>

              {/* LAN Subsection */}
              <Box sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 1,
                p: 1.25,
              }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mb: 1,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'success.main',
                    letterSpacing: '0.05em',
                  }}
                >
                  LAN / {t('assets.internalNetwork', 'internal network')}
                </Typography>

                <CompactField
                  label={t('assets.ipAddress', 'IP Address')}
                  value={getProp('lan_ip_address')}
                  monospace
                  copyable
                  onCopy={() => handleCopy(getProp('lan_ip_address') || '')}
                  ltr
                />

                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  mt: 1,
                }}>
                  <CompactField
                    label={t('assets.webPort', 'Web Port')}
                    value={getProp('lan_http_port') || '80'}
                    monospace
                  />
                  <CompactField
                    label={t('assets.servicePort', 'Service Port')}
                    value={getProp('lan_service_port') || '8000'}
                    monospace
                  />
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* ── Quick Actions Card ─────────────────────────────────────── */}
        <Card variant="outlined">
          <CardContent sx={CARD_CONTENT_SX}>
            <SectionHeader
              icon={<FlashOnIcon sx={{ fontSize: 18 }} />}
              title={t('assets.quickActions', '\u05E4\u05E2\u05D5\u05DC\u05D5\u05EA \u05DE\u05D4\u05D9\u05E8\u05D5\u05EA')}
            />
            <Stack spacing={1}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={probePending ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                onClick={onProbeDevice}
                disabled={probePending || !canProbe}
                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
              >
                {t('assets.probeDevice', 'Probe Device')}
              </Button>

              {shouldShowServiceTicketButton && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<ConfirmationNumberIcon />}
                  onClick={onOpenServiceTicket}
                  sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                >
                  {t('assets.openServiceTicket', 'Open Service Ticket')}
                </Button>
              )}

              {hasTimeDrift && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="warning"
                  startIcon={<SyncIcon />}
                  onClick={onTimeSyncClick}
                  sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                >
                  {t('probe.syncTime', 'Sync Time')}
                </Button>
              )}

              <Tooltip title={t('assets.comingSoon', 'Coming soon')}>
                <span>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    disabled
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                  >
                    {t('assets.testConnection', 'Test Connection')}
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title={t('assets.comingSoon', 'Coming soon')}>
                <span>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    disabled
                    sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                  >
                    {t('assets.reboot', 'Reboot')}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* ==================================================================
          ROW 2: Health Gauge (4/12) + Credentials (4/12) + System Specs (4/12)
          ================================================================== */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
        gap: 1.5,
      }}>
        {/* ── Health Gauge Card ──────────────────────────────────────── */}
        <Card variant="outlined">
          <CardContent sx={CARD_CONTENT_SX}>
            <SectionHeader
              icon={<FavoriteIcon sx={{ fontSize: 18 }} />}
              title={t('assets.deviceHealth', '\u05D1\u05E8\u05D9\u05D0\u05D5\u05EA \u05D4\u05DE\u05DB\u05E9\u05D9\u05E8')}
              color={
                healthStatus === 'ok' ? '#00d2b4'
                : healthStatus === 'warning' ? '#ffb347'
                : healthStatus === 'critical' ? '#ff4d6a'
                : 'text.secondary'
              }
            />
            <HealthGauge
              status={healthStatus}
              channelsOnline={onlineCount}
              channelsTotal={totalConfigured}
              recordingOk={recordingOkCount}
              recordingTotal={totalConfigured}
              diskTemp={maxDiskTemp}
              uptimeDisplay={uptimeDisplay}
            />
          </CardContent>
        </Card>

        {/* ── Credentials Card ──────────────────────────────────────── */}
        <Card variant="outlined">
          <CardContent sx={CARD_CONTENT_SX}>
            <SectionHeader
              icon={<VpnKeyIcon sx={{ fontSize: 18 }} />}
              title={t('assets.credentials', '\u05E4\u05E8\u05D8\u05D9 \u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA')}
            />
            <Stack spacing={1.5}>
              <CompactField
                label={t('assets.deviceUsername', 'Username')}
                value={getProp('device_username')}
                monospace
                copyable
                onCopy={() => handleCopy(getProp('device_username') || '')}
              />
              <SecretField
                label={t('assets.devicePassword', 'Password')}
                value={getProp('device_password')}
                fieldKey="device_password"
                visibleSecrets={visibleSecrets}
                toggleSecretVisibility={toggleSecretVisibility}
                handleCopy={handleCopy}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* ── System Specs Card ─────────────────────────────────────── */}
        <Card variant="outlined">
          <CardContent sx={CARD_CONTENT_SX}>
            <SectionHeader
              icon={<SettingsIcon sx={{ fontSize: 18 }} />}
              title={t('assets.systemSpecs', '\u05DE\u05E4\u05E8\u05D8 \u05DE\u05E2\u05E8\u05DB\u05EA')}
            />

            {/* Big numbers */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              mb: 1.5,
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  sx={{
                    fontFamily: MONO_FONT,
                    fontWeight: 700,
                    fontSize: '1.75rem',
                    color: 'primary.main',
                    lineHeight: 1.2,
                  }}
                >
                  {getProp('camera_count_connected') ?? '\u2014'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {t('assets.connectedCameras', 'Connected')}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  sx={{
                    fontFamily: MONO_FONT,
                    fontWeight: 700,
                    fontSize: '1.75rem',
                    color: 'primary.main',
                    lineHeight: 1.2,
                  }}
                >
                  {getProp('max_camera_channels') ?? '\u2014'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {t('assets.maxChannels', 'Max Channels')}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 1 }} />

            {/* POE info */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <CompactField
                label={t('assets.poeSupported', 'POE Support')}
                value={
                  getProp('poe_supported') === true || getProp('poe_supported') === 'true'
                    ? t('common.yes', 'Yes')
                    : t('common.no', 'No')
                }
              />
              {(getProp('poe_supported') === true || getProp('poe_supported') === 'true') && (
                <CompactField
                  label={t('assets.poePorts', 'POE Ports')}
                  value={getProp('poe_port_count')}
                  monospace
                />
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ==================================================================
          ROW 3: Storage / HDD Table (full width)
          ================================================================== */}
      <Card
        variant="outlined"
        sx={hasDiskIssues ? { borderColor: 'error.main', borderWidth: 2 } : undefined}
      >
        <CardContent sx={CARD_CONTENT_SX}>
          <SectionHeader
            icon={<StorageIcon sx={{ fontSize: 18 }} />}
            title={t('assets.storage', 'Storage')}
            color={hasDiskIssues ? 'error.main' : 'primary.main'}
            action={
              hasDiskIssues ? (
                <Chip
                  icon={<WarningIcon sx={{ fontSize: 14 }} />}
                  label={t('assets.diskIssue', 'Disk Issue')}
                  color="error"
                  size="small"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              ) : undefined
            }
          />

          <Box sx={{ position: 'relative' }}>
            {/* Loading overlay while probing */}
            {probePending && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                borderRadius: 1,
              }}>
                <CircularProgress size={32} />
              </Box>
            )}

            {disks && disks.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                        {t('assets.diskSlot', 'Slot')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                        {t('assets.diskCapacity', 'Capacity')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                        {t('assets.diskSerial', 'Serial')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                        {t('assets.diskStatus', 'Status')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                        S.M.A.R.T.
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                        {t('assets.diskTemp', 'Temp')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                        {t('assets.diskRuntime', 'Runtime')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {disks.map((disk: any, index: number) => {
                      const isBad = isDiskStatusBad(disk.status);
                      return (
                        <TableRow
                          key={disk.id || index}
                          sx={isBad ? { bgcolor: 'rgba(255, 77, 106, 0.08)' } : undefined}
                        >
                          <TableCell sx={{ py: 0.5, fontSize: '0.85rem', fontFamily: MONO_FONT }}>
                            {disk.slot_number ?? (index + 1)}
                          </TableCell>
                          <TableCell sx={{ py: 0.5, fontSize: '0.85rem', fontFamily: MONO_FONT }}>
                            {disk.capacity_tb ? `${disk.capacity_tb} TB` : '\u2014'}
                          </TableCell>
                          <TableCell sx={{ py: 0.5, fontSize: '0.85rem' }}>
                            {disk.serial_number ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography
                                  variant="body2"
                                  dir="ltr"
                                  sx={{ fontFamily: MONO_FONT, fontSize: '0.8rem' }}
                                >
                                  {disk.serial_number.length > 16
                                    ? `${disk.serial_number.slice(0, 8)}\u2026${disk.serial_number.slice(-6)}`
                                    : disk.serial_number}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopy(disk.serial_number)}
                                  sx={{ p: 0.25, opacity: 0.5, '&:hover': { opacity: 1 } }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Box>
                            ) : '\u2014'}
                          </TableCell>
                          <TableCell sx={{ py: 0.5 }}>
                            <Chip
                              label={getDiskStatusLabel(disk.status, t)}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: isBad ? 'rgba(255, 77, 106, 0.15)' : 'rgba(0, 210, 180, 0.12)',
                                color: isBad ? '#ff4d6a' : '#00d2b4',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 0.5 }}>
                            {disk.smart_status ? (
                              <Chip
                                label={disk.smart_status}
                                size="small"
                                icon={
                                  disk.smart_status === 'Pass'
                                    ? <CheckCircleIcon sx={{ fontSize: 12 }} />
                                    : <ErrorIcon sx={{ fontSize: 12 }} />
                                }
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  '& .MuiChip-icon': { fontSize: 12 },
                                  bgcolor: disk.smart_status === 'Pass'
                                    ? 'rgba(0, 210, 180, 0.12)'
                                    : 'rgba(255, 77, 106, 0.15)',
                                  color: disk.smart_status === 'Pass' ? '#00d2b4' : '#ff4d6a',
                                }}
                              />
                            ) : '\u2014'}
                          </TableCell>
                          <TableCell sx={{
                            py: 0.5,
                            fontSize: '0.85rem',
                            fontFamily: MONO_FONT,
                            color: disk.temperature != null && disk.temperature > 55
                              ? '#ff4d6a'
                              : disk.temperature != null && disk.temperature > 45
                                ? '#ffb347'
                                : 'inherit',
                          }}>
                            {formatTemperature(disk.temperature)}
                          </TableCell>
                          <TableCell sx={{ py: 0.5, fontSize: '0.85rem', fontFamily: MONO_FONT }}>
                            {formatRuntime(disk.working_hours, locale)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2, textAlign: 'center' }}>
                {t('assets.noDisks', 'No disk data available. Run a probe to detect storage.')}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* ==================================================================
          ROW 4: Channel Status (full width)
          ================================================================== */}
      <Card variant="outlined">
        <CardContent sx={CARD_CONTENT_SX}>
          <SectionHeader
            icon={<VideocamIcon sx={{ fontSize: 18 }} />}
            title={t('assets.channelStatus', '\u05E1\u05D8\u05D8\u05D5\u05E1 \u05E2\u05E8\u05D5\u05E6\u05D9\u05DD \u05D5\u05D4\u05E7\u05DC\u05D8\u05D4')}
            action={
              <Stack direction="row" spacing={0.5} alignItems="center">
                {totalConfigured > 0 && (
                  <>
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                      label={`OK ${onlineCount}/${totalConfigured}`}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: onlineCount === totalConfigured
                          ? 'rgba(0, 210, 180, 0.12)'
                          : 'rgba(255, 179, 71, 0.12)',
                        color: onlineCount === totalConfigured ? '#00d2b4' : '#ffb347',
                        '& .MuiChip-icon': { color: 'inherit' },
                      }}
                    />
                    <Chip
                      icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                      label={`REC ${recordingOkCount}/${totalConfigured}`}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: recordingOkCount === totalConfigured
                          ? 'rgba(0, 210, 180, 0.12)'
                          : 'rgba(255, 77, 106, 0.12)',
                        color: recordingOkCount === totalConfigured ? '#00d2b4' : '#ff4d6a',
                        '& .MuiChip-icon': { color: 'inherit' },
                      }}
                    />
                  </>
                )}
              </Stack>
            }
          />

          {channels && channels.length > 0 ? (
            <>
              {/* ── Default View: Visual Camera Grid ──────────────────── */}
              {!channelEditMode && (
                <>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(4, 1fr)',
                      md: 'repeat(6, 1fr)',
                      lg: 'repeat(8, 1fr)',
                    },
                    gap: 1,
                    mb: 1.5,
                  }}>
                    {channels.map((channel) => {
                      const isIgnored = channel.is_ignored;
                      const isOnline = channel.is_online && channel.is_configured;
                      const isRecording = channel.has_recording_24h && channel.is_configured;

                      return (
                        <Card
                          key={channel.channel_number}
                          variant="outlined"
                          sx={{
                            opacity: isIgnored ? 0.4 : 1,
                            bgcolor: 'rgba(255,255,255,0.02)',
                            border: '1px solid',
                            borderColor: isIgnored
                              ? 'rgba(255,255,255,0.06)'
                              : isOnline
                                ? 'rgba(0, 210, 180, 0.25)'
                                : channel.is_configured
                                  ? 'rgba(255, 77, 106, 0.25)'
                                  : 'rgba(255,255,255,0.06)',
                            transition: 'all 0.2s',
                            cursor: isOnline && !isPortalUser ? 'pointer' : 'default',
                            '&:hover': isOnline && !isPortalUser ? {
                              borderColor: 'primary.main',
                              bgcolor: 'rgba(255,255,255,0.05)',
                            } : {},
                          }}
                          onClick={() => {
                            if (isOnline && !isPortalUser) {
                              onSnapshotClick(channel.channel_number);
                            }
                          }}
                        >
                          <CardContent sx={{ p: 0.75, '&:last-child': { pb: 0.75 }, textAlign: 'center' }}>
                            {/* Camera icon */}
                            {channel.is_configured ? (
                              <VideocamIcon sx={{
                                fontSize: 20,
                                color: isOnline ? '#00d2b4' : '#ff4d6a',
                                mb: 0.25,
                              }} />
                            ) : (
                              <VideocamOffIcon sx={{
                                fontSize: 20,
                                color: 'text.disabled',
                                mb: 0.25,
                              }} />
                            )}

                            {/* Channel number */}
                            <Typography
                              sx={{
                                fontFamily: MONO_FONT,
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                lineHeight: 1.2,
                              }}
                            >
                              {channel.name || `CH ${channel.channel_number}`}
                            </Typography>

                            {/* Custom name */}
                            {channel.custom_name && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: 'block',
                                  fontSize: '0.65rem',
                                  lineHeight: 1.1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {channel.custom_name}
                              </Typography>
                            )}

                            {/* Status dots */}
                            {channel.is_configured && !isIgnored && (
                              <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ mt: 0.5 }}>
                                <Tooltip title={isOnline ? t('assets.online', 'Online') : t('assets.offline', 'Offline')}>
                                  <FiberManualRecordIcon sx={{
                                    fontSize: 8,
                                    color: isOnline ? '#00d2b4' : '#ff4d6a',
                                  }} />
                                </Tooltip>
                                <Tooltip title={isRecording ? t('assets.recording', 'Recording') : t('assets.notRecording', 'Not Recording')}>
                                  <FiberManualRecordIcon sx={{
                                    fontSize: 8,
                                    color: isRecording ? '#00d2b4' : '#ff4d6a',
                                  }} />
                                </Tooltip>
                              </Stack>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>

                  {/* Edit button */}
                  {!isPortalUser && (
                    <Box sx={{ textAlign: 'center' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                        onClick={onEditChannelsClick}
                        sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                      >
                        {t('assets.editChannels', 'Edit Channels')}
                      </Button>
                    </Box>
                  )}
                </>
              )}

              {/* ── Edit Mode: Table View ─────────────────────────────── */}
              {channelEditMode && (
                <>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={channelUpdatePending ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                      onClick={onSaveChannels}
                      disabled={channelUpdatePending}
                      sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                    >
                      {t('common.save', 'Save')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
                      onClick={onCancelChannelEdits}
                      disabled={channelUpdatePending}
                      sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                  </Stack>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                          <TableCell sx={{ fontWeight: 600, width: 90, py: 0.75, fontSize: '0.8rem' }}>
                            {t('assets.channelNumber', 'CH #')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                            {t('assets.channelName', 'Name')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                            {t('assets.channelCustomName', 'Custom Name')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                            {t('assets.channelNotes', 'Notes')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem', width: 70 }}>
                            {t('assets.channelIgnore', 'Ignore')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                            {t('assets.channelStatusLabel', 'Status')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>
                            {t('assets.channelRecording', 'Recording')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {channels.map((channel) => {
                          const edit = channelEdits.get(channel.channel_number);
                          const isIgnored = edit ? edit.is_ignored : channel.is_ignored;

                          return (
                            <TableRow
                              key={channel.channel_number}
                              sx={{ opacity: isIgnored ? 0.5 : 1 }}
                            >
                              <TableCell sx={{ py: 0.5, fontFamily: MONO_FONT, fontSize: '0.85rem' }}>
                                {channel.channel_number}
                              </TableCell>
                              <TableCell sx={{ py: 0.5, fontSize: '0.85rem' }}>
                                {channel.name || '\u2014'}
                              </TableCell>
                              <TableCell sx={{ py: 0.5 }}>
                                <TextField
                                  size="small"
                                  variant="outlined"
                                  value={edit?.custom_name ?? channel.custom_name ?? ''}
                                  onChange={(e) => onChannelFieldChange(
                                    channel.channel_number,
                                    'custom_name',
                                    e.target.value || undefined
                                  )}
                                  sx={{ '& input': { py: 0.5, fontSize: '0.85rem' } }}
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.5 }}>
                                <TextField
                                  size="small"
                                  variant="outlined"
                                  value={edit?.notes ?? channel.notes ?? ''}
                                  onChange={(e) => onChannelFieldChange(
                                    channel.channel_number,
                                    'notes',
                                    e.target.value || undefined
                                  )}
                                  sx={{ '& input': { py: 0.5, fontSize: '0.85rem' } }}
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.5, textAlign: 'center' }}>
                                <Checkbox
                                  size="small"
                                  checked={isIgnored}
                                  onChange={(e) => onChannelFieldChange(
                                    channel.channel_number,
                                    'is_ignored',
                                    e.target.checked
                                  )}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 0.5 }}>
                                {channel.is_configured ? (
                                  <Chip
                                    icon={channel.is_online
                                      ? <CheckCircleIcon sx={{ fontSize: 12 }} />
                                      : <ErrorIcon sx={{ fontSize: 12 }} />}
                                    label={channel.is_online
                                      ? t('assets.online', 'Online')
                                      : t('assets.offline', 'Offline')}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      '& .MuiChip-icon': { fontSize: 12 },
                                      bgcolor: channel.is_online
                                        ? 'rgba(0, 210, 180, 0.12)'
                                        : 'rgba(255, 77, 106, 0.12)',
                                      color: channel.is_online ? '#00d2b4' : '#ff4d6a',
                                    }}
                                  />
                                ) : (
                                  <Typography variant="caption" color="text.disabled">
                                    {t('assets.notConfigured', 'N/C')}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ py: 0.5 }}>
                                {channel.is_configured ? (
                                  <Chip
                                    icon={<FiberManualRecordIcon sx={{ fontSize: 8 }} />}
                                    label={channel.has_recording_24h ? 'REC' : 'NO REC'}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      '& .MuiChip-icon': { fontSize: 8 },
                                      bgcolor: channel.has_recording_24h
                                        ? 'rgba(0, 210, 180, 0.12)'
                                        : 'rgba(255, 77, 106, 0.12)',
                                      color: channel.has_recording_24h ? '#00d2b4' : '#ff4d6a',
                                    }}
                                  />
                                ) : '\u2014'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2, textAlign: 'center' }}>
              {t('assets.noChannels', 'No channel data available. Run a probe to detect cameras.')}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* ==================================================================
          ROW 5: Additional Properties + Recent Activity
          ================================================================== */}
      {(remainingProperties.length > 0 || (events && events.length > 0)) && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 1.5,
        }}>
          {/* ── Additional Properties ───────────────────────────────── */}
          {remainingProperties.length > 0 && (
            <Card variant="outlined">
              <CardContent sx={CARD_CONTENT_SX}>
                <SectionHeader
                  icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
                  title={t('assets.additionalProperties', 'Additional Properties')}
                />
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                  gap: 1,
                }}>
                  {remainingProperties.map((prop) => (
                    prop.data_type === 'secret' ? (
                      <SecretField
                        key={prop.key}
                        label={prop.label}
                        value={prop.value}
                        fieldKey={prop.key}
                        visibleSecrets={visibleSecrets}
                        toggleSecretVisibility={toggleSecretVisibility}
                        handleCopy={handleCopy}
                      />
                    ) : (
                      <CompactField
                        key={prop.key}
                        label={prop.label}
                        value={
                          prop.data_type === 'bool'
                            ? (prop.value === true || prop.value === 'true'
                                ? t('common.yes', 'Yes')
                                : t('common.no', 'No'))
                            : prop.data_type === 'date' && prop.value
                              ? format(new Date(prop.value), 'dd/MM/yyyy')
                              : String(prop.value ?? '')
                        }
                        monospace={prop.data_type === 'string' || prop.data_type === 'int' || prop.data_type === 'decimal'}
                        copyable={!!prop.value}
                        onCopy={() => handleCopy(String(prop.value ?? ''))}
                      />
                    )
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* ── Recent Activity ─────────────────────────────────────── */}
          {events && events.length > 0 && (
            <Card variant="outlined">
              <CardContent sx={CARD_CONTENT_SX}>
                <SectionHeader
                  icon={<HistoryIcon sx={{ fontSize: 18 }} />}
                  title={t('assets.recentActivity', 'Recent Activity')}
                />
                <Stack spacing={0.75}>
                  {events.slice(0, 5).map((event: any, index: number) => (
                    <Box
                      key={event.id || index}
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'flex-start',
                        py: 0.5,
                        borderBottom: index < Math.min(events.length, 5) - 1
                          ? '1px solid'
                          : 'none',
                        borderColor: 'divider',
                      }}
                    >
                      {/* Event type indicator */}
                      <Box sx={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mt: 0.25,
                      }}>
                        <Typography sx={{ fontSize: '0.75rem' }}>
                          {event.event_type === 'probe' ? '\uD83D\uDD0D'
                            : event.event_type === 'password_change' ? '\uD83D\uDD11'
                            : event.event_type === 'channel_update' ? '\uD83D\uDCF9'
                            : event.event_type === 'time_sync' ? '\u23F0'
                            : event.event_type === 'disk_added' || event.event_type === 'disk_removed' ? '\uD83D\uDCBE'
                            : '\u2022'}
                        </Typography>
                      </Box>

                      {/* Event details */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                        </Typography>
                        {event.details && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              fontSize: '0.75rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {event.details}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {event.created_at
                              ? format(new Date(event.created_at), 'dd/MM/yyyy HH:mm')
                              : ''}
                          </Typography>
                          {event.actor_display && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {event.actor_display}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
};

export default NVRDetailsView;

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';
import { copyToClipboard as copyText } from '@/utils/clipboard';
import {
  Box,
  Typography,
  Grid,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Link,
  List,
  ListItem,
  ListItemText,
  Divider,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  Checkbox,
  Stack,
} from '@mui/material';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { assetsApi } from '@/api/assets';
import { portalAssetsApi } from '@/api/portalAssets';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { hikvisionApi } from '@/api/hikvision';
import { BackButton } from '@/components/Common/BackButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RouterIcon from '@mui/icons-material/Router';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import WarningIcon from '@mui/icons-material/Warning';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SyncIcon from '@mui/icons-material/Sync';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { AssetForm } from './AssetForm';
import { HealthStatusIcon } from './HealthStatusIcon';
import { RouterConfigStatusIcon } from './RouterConfigStatusIcon';
import { RouterDetailsView } from './RouterDetailsView';
import { AccessPointDetailsView } from './AccessPointDetailsView';
import { SwitchDetailsView } from './SwitchDetailsView';
import { getRouterConfigStatus } from '@/utils/routerConfigStatus';
import { getAPConfigStatus } from '@/utils/accessPointConfigStatus';
import { getSwitchConfigStatus } from '@/utils/switchConfigStatus';
import { TicketForm } from '../Tickets/TicketForm';
import { TimeSyncDialog } from './TimeSyncDialog';
import { AssetProperty, AssetUsageSummary, HikvisionProbeResponse, HealthStatus, NVRChannelBulkUpdate, Client, Site, ChannelWithStatus } from '@/types';
import { formatRuntime, formatTemperature } from '@/utils/formatters';
import { SmartProbeLoader } from './SmartProbeLoader';
import {
  isDiskStatusBad,
  getDiskStatusLabel,
} from '@/utils/diskStatus';
import { generateTicketFromProbe } from '@/utils/issueDescriptionGenerator';
import { useResponsive } from '@/hooks/useResponsive';

// ============================================================================
// COMPACT FIELD COMPONENTS
// ============================================================================

// Readable monospace font stack for technical data
const MONO_FONT = '"SF Mono", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace';

// Compact field for technical info display - optimized for readability
const CompactField: React.FC<{
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
        {value || '—'}
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

// Truncated serial number with tooltip showing full value
const TruncatedSerial: React.FC<{
  serial: string | null | undefined;
  onCopy: () => void;
}> = ({ serial, onCopy }) => {
  if (!serial) return <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>—</Typography>;

  // Show first 6 and last 6 chars if long enough
  const truncated = serial.length > 14
    ? `${serial.slice(0, 6)}…${serial.slice(-6)}`
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

// Card section header - compact
const SectionHeader: React.FC<{
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AssetDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { showError, showSuccess } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const locale = i18n.language;
  const { isMobile, isDesktop } = useResponsive();
  // Show inline actions in header for mobile and tablet (not desktop - desktop has sidebar)
  const showInlineActions = !isDesktop;

  // Determine if user is portal user
  const isPortalUser = user?.user_type === 'portal';

  // Context-aware navigation base paths
  const basePrefix = location.pathname.startsWith('/portal') ? '/portal' : '/admin';
  const clientsBasePath = `${basePrefix}/clients`;
  const ticketsBasePath = `${basePrefix}/tickets`;

  const [currentTab, setCurrentTab] = useState(0);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const toggleSecretVisibility = useCallback((key: string) => {
    setVisibleSecrets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const [lastProbeResult, setLastProbeResult] = useState<HikvisionProbeResponse | null>(null);
  const [channelAccordionExpanded, setChannelAccordionExpanded] = useState(false);
  const [ticketFormOpen, setTicketFormOpen] = useState(false);
  const [ticketPrefillData, setTicketPrefillData] = useState<any>(null);
  const [usageSummaryOpen, setUsageSummaryOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [usageSummary, setUsageSummary] = useState<AssetUsageSummary | null>(null);

  // Smart Probe Loader state
  const [probeDialogOpen, setProbeDialogOpen] = useState(false);
  const [probeError, setProbeError] = useState<Error | null>(null);

  // Time Sync Dialog state
  const [timeSyncDialogOpen, setTimeSyncDialogOpen] = useState(false);

  // Channel editing state
  const [channelEditMode, setChannelEditMode] = useState(false);
  const [channelEdits, setChannelEdits] = useState<Map<number, NVRChannelBulkUpdate>>(new Map());

  // Snapshot preview state
  const [snapshotChannel, setSnapshotChannel] = useState<number | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // Copy to clipboard helper
  const handleCopy = async (text: string) => {
    const success = await copyText(text);
    if (success) {
      showSuccess(t('assets.copied'));
    } else {
      showError(t('app.copyError'));
    }
  };

  // Snapshot preview handler
  const handleSnapshotClick = async (channelNum: number) => {
    if (!id) return;
    // Cleanup previous snapshot URL
    if (snapshotUrl) {
      URL.revokeObjectURL(snapshotUrl);
    }
    setSnapshotChannel(channelNum);
    setSnapshotUrl(null);
    setSnapshotError(null);
    setSnapshotLoading(true);
    try {
      const blob = await hikvisionApi.getSnapshot(id, channelNum);
      const url = URL.createObjectURL(blob);
      setSnapshotUrl(url);
    } catch (err: any) {
      setSnapshotError(err?.response?.data?.detail || err?.message || t('assets.snapshotError'));
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleSnapshotClose = () => {
    if (snapshotUrl) {
      URL.revokeObjectURL(snapshotUrl);
    }
    setSnapshotChannel(null);
    setSnapshotUrl(null);
    setSnapshotError(null);
  };

  // Check if user can edit assets
  // - Internal users: admin or technician
  // - Portal users: CLIENT_ADMIN only
  const canEditAsset = isPortalUser
    ? user?.role === 'client_admin'
    : (user?.role === 'admin' || user?.role === 'technician');

  // Check if user can delete assets (internal admin only)
  const _canDeleteAsset = !isPortalUser && user?.role === 'admin';

  // Fetch asset
  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id, isPortalUser],
    queryFn: () => isPortalUser ? portalAssetsApi.get(id!) : assetsApi.getAsset(id!),
    enabled: !!id,
  });

  // Fetch asset types - use portal API for portal users
  const { data: assetTypes } = useQuery({
    queryKey: ['asset-types', isPortalUser],
    queryFn: () => isPortalUser ? portalAssetsApi.getAssetTypes() : assetsApi.listAssetTypes(),
  });

  // Fetch client info - use portal API for portal users
  const { data: client } = useQuery({
    queryKey: ['client', asset?.client_id, isPortalUser],
    queryFn: async () => {
      if (isPortalUser) {
        const result = await portalClientsApi.get(asset!.client_id);
        return { id: result.id, name: result.name, is_active: result.is_active, created_at: '', updated_at: '' } as Client;
      }
      return clientsApi.getClient(asset!.client_id);
    },
    enabled: !!asset?.client_id,
  });

  // Fetch site info - use portal API for portal users
  const { data: site } = useQuery({
    queryKey: ['site', asset?.site_id, isPortalUser],
    queryFn: async () => {
      if (isPortalUser) {
        const result = await portalClientsApi.getSite(asset!.site_id);
        return { id: result.id, name: result.name, client_id: result.client_id, address: result.address, is_default: false, created_at: '', updated_at: '' } as Site;
      }
      return clientsApi.getSite(asset!.site_id);
    },
    enabled: !!asset?.site_id,
  });

  // Create property lookup map for quick access
  const propertyMap = useMemo(() => {
    if (!asset?.properties) return new Map<string, AssetProperty>();
    return new Map(asset.properties.map(p => [p.key, p]));
  }, [asset?.properties]);

  // Helper to get property value
  const getProp = (key: string): any => propertyMap.get(key)?.value;

  // Fetch NVR disks if this is an NVR/DVR - use portal API for portal users
  const isNvrDvr = asset?.asset_type_code === 'NVR' || asset?.asset_type_code === 'DVR';
  const isRouterType = asset?.asset_type_code === 'ROUTER';
  const isAccessPointType = asset?.asset_type_code === 'ACCESS_POINT';
  const isSwitchType = asset?.asset_type_code === 'SWITCH';
  const isSimplifiedType = isRouterType || isAccessPointType || isSwitchType;

  const routerConfigResult = useMemo(() => {
    if (!isRouterType) return null;
    return getRouterConfigStatus(getProp);
  }, [isRouterType, propertyMap]);

  const apConfigResult = useMemo(() => {
    if (!isAccessPointType) return null;
    return getAPConfigStatus(getProp);
  }, [isAccessPointType, propertyMap]);

  const switchConfigResult = useMemo(() => {
    if (!isSwitchType) return null;
    return getSwitchConfigStatus(getProp);
  }, [isSwitchType, propertyMap]);

  // Unified config result for simplified types (Router, AP, Switch)
  const configResult = routerConfigResult || apConfigResult || switchConfigResult;

  const { data: disks } = useQuery({
    queryKey: ['asset-disks', id, isPortalUser],
    queryFn: () => isPortalUser
      ? portalAssetsApi.getDisks(id!)
      : assetsApi.getAssetDisks(id!),
    enabled: !!id && isNvrDvr,
  });

  // Fetch channels with customization for NVR/DVR assets - use portal API for portal users
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['asset-channels', id, isPortalUser],
    queryFn: async (): Promise<ChannelWithStatus[]> => {
      if (isPortalUser) {
        const result = await portalAssetsApi.getChannels(id!);
        return result.map(ch => ({
          channel_number: ch.channel_number,
          custom_name: ch.custom_name ?? undefined,
          is_ignored: ch.is_ignored,
          notes: ch.notes ?? undefined,
          name: ch.name ?? undefined,
          ip_address: ch.ip_address ?? undefined,
          is_configured: ch.is_configured,
          is_online: ch.is_online,
          has_recording_24h: ch.has_recording_24h,
          updated_by_actor_display: ch.updated_by_actor_display ?? undefined,
          updated_at: ch.updated_at ?? undefined,
        }));
      }
      return assetsApi.getChannels(id!);
    },
    enabled: !!id && isNvrDvr,
  });

  // DEBUG: Log channels data
  useEffect(() => {
    logger.debug('[AssetDetails] Channels data:', {
      channels,
      isLoading: channelsLoading,
      isNvrDvr,
      enabled: !!id && isNvrDvr
    });
  }, [channels, channelsLoading, isNvrDvr, id]);

  // Fetch asset events for Activity tab - use portal API for portal users
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['asset-events', id, isPortalUser],
    queryFn: () => isPortalUser
      ? portalAssetsApi.getEvents(id!)
      : assetsApi.getAssetEvents(id!),
    enabled: !!id && currentTab === 2,
  });

  // Probe mutation - use portal API for portal users
  const probeMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Asset ID is required');
      if (isPortalUser) {
        // Portal API returns ProbeResult, convert to HikvisionProbeResponse format
        const portalResult = await portalAssetsApi.probe(id);
        // Create a compatible response object for UI
        return {
          meta: { success: portalResult.success, errors: {} },
          device: {} as any,
          network: { lan_ips: [] },
          storage: { disk_count: 0, disks: [] },
          cameras: { total: 0, online: 0, offline: 0, recording_ok: 0, recording_missing: 0, channels: [] },
          health_summary: {
            total_hdd: 0, healthy_hdd: 0, critical_hdd: 0,
            total_channels: 0, configured_channels: 0, online_channels: 0,
            offline_channels: 0, unconfigured_channels: 0, channels_with_recordings: 0,
            overall_status: portalResult.health_status as any,
            issues: portalResult.health_issues,
          },
          _portal_message: portalResult.message,
        } as HikvisionProbeResponse & { _portal_message: string };
      }
      return hikvisionApi.probeAndSaveAsset(id);
    },
    onSuccess: (result) => {
      setLastProbeResult(result);
      setProbeError(null);

      const diskIssues = result.storage?.disks?.some(
        (d: { status?: string }) => {
          const status = d.status?.toLowerCase();
          return status && status !== 'ok' && status !== 'healthy' && status !== 'normal';
        }
      );

      const hasRecordingIssues = (result.cameras?.recording_missing ?? 0) > 0;
      const healthStatus = result.health_summary?.overall_status;
      const isHealthy = healthStatus === 'healthy' || healthStatus === 'ok';

      if (diskIssues && hasRecordingIssues && !isHealthy) {
        showError(t('assets.recordingDiskWarning'));
      } else if (diskIssues) {
        showError(t('assets.probeWarningDiskIssue'));
      } else if (hasRecordingIssues && !isHealthy) {
        showError(t('assets.recordingMissingCount', { count: result.cameras.recording_missing }));
      }

      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      queryClient.invalidateQueries({ queryKey: ['asset-disks', id] });
      queryClient.invalidateQueries({ queryKey: ['asset-channels', id] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (error: any) => {
      setProbeError(error);
    },
  });

  const handleProbeDevice = () => {
    setProbeError(null);
    setProbeDialogOpen(true);
    probeMutation.mutate();
  };

  const handleProbeDialogClose = () => {
    setProbeDialogOpen(false);
    setProbeError(null);
  };

  const handleProbeRetry = () => {
    setProbeError(null);
    probeMutation.mutate();
  };

  // Usage summary query (for delete confirmation)
  const usageSummaryQuery = useQuery({
    queryKey: ['assetUsageSummary', id],
    queryFn: () => assetsApi.getAssetUsageSummary(id!),
    enabled: false,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => assetsApi.deleteAsset(id!),
    onSuccess: () => {
      showSuccess(t('assets.deleteSuccess'));
      navigate('/assets');
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t('assets.deleteError'));
    }
  });

  // Channel bulk update mutation - use portal API for portal users
  const channelUpdateMutation = useMutation({
    mutationFn: (channelUpdates: NVRChannelBulkUpdate[]) => {
      if (!id) throw new Error('Asset ID is required');
      return isPortalUser
        ? portalAssetsApi.bulkUpdateChannels(id, channelUpdates)
        : assetsApi.bulkUpdateChannels(id, { channels: channelUpdates });
    },
    onSuccess: () => {
      showSuccess(t('assets.channelsUpdated'));
      queryClient.invalidateQueries({ queryKey: ['asset-channels', id] });
      queryClient.invalidateQueries({ queryKey: ['asset-events', id] });
      setChannelEditMode(false);
      setChannelEdits(new Map());
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t('assets.channelsUpdateError'));
    }
  });

  const handleDeleteClick = async () => {
    const summary = await usageSummaryQuery.refetch();
    if (summary.data) {
      setUsageSummary(summary.data);
      setUsageSummaryOpen(true);
    }
  };

  const handleProceedToFinalConfirm = () => {
    setUsageSummaryOpen(false);
    setDeleteConfirmOpen(true);
  };

  const handleFinalDelete = async () => {
    setDeleteConfirmOpen(false);
    await deleteMutation.mutateAsync();
  };

  // Channel editing handlers
  const handleEditChannelsClick = () => {
    if (channels) {
      const initialEdits = new Map<number, NVRChannelBulkUpdate>();
      channels.forEach(ch => {
        initialEdits.set(ch.channel_number, {
          channel_number: ch.channel_number,
          custom_name: ch.custom_name,
          is_ignored: ch.is_ignored,
          notes: ch.notes,
        });
      });
      setChannelEdits(initialEdits);
    }
    setChannelEditMode(true);
  };

  const handleCancelChannelEdits = () => {
    setChannelEditMode(false);
    setChannelEdits(new Map());
  };

  const handleSaveChannels = () => {
    const updates = Array.from(channelEdits.values());
    channelUpdateMutation.mutate(updates);
  };

  const handleChannelFieldChange = (channelNumber: number, field: keyof NVRChannelBulkUpdate, value: any) => {
    setChannelEdits(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(channelNumber) || {
        channel_number: channelNumber,
        custom_name: undefined,
        is_ignored: false,
        notes: undefined,
      };
      newMap.set(channelNumber, { ...existing, [field]: value });
      return newMap;
    });
  };

  // Create lookup maps
  const assetTypeMap = useMemo(() => {
    if (!assetTypes) return new Map();
    return new Map(assetTypes.map(t => [t.code, t]));
  }, [assetTypes]);

  // Helper functions
  const getAssetTypeName = (code: string): string => {
    const type = assetTypeMap.get(code);
    if (!type) return code;
    return locale === 'he' ? (type.name_he || code) : (type.name_en || code);
  };

  // Show error toast if needed
  useEffect(() => {
    if (error) {
      showError(t('app.error') + ': ' + ((error as any)?.message || 'Failed to load asset'));
    }
  }, [error, showError, t]);

  const handleEditSuccess = () => {
    setEditFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ['asset', id] });
    queryClient.invalidateQueries({ queryKey: ['asset-disks', id] });
    queryClient.invalidateQueries({ queryKey: ['asset-events', id] });
  };

  const handleOpenServiceTicket = () => {
    if (!asset) return;

    const healthIssues = asset.health_issues || [];
    const healthStatus = asset.health_status || 'unknown';
    const localeCode = locale === 'he' ? 'he' : 'en';

    // If we have probe result, use full generation
    if (lastProbeResult) {
      const generatedData = generateTicketFromProbe(
        lastProbeResult,
        healthStatus,
        healthIssues,
        {
          locale: localeCode,
          assetLabel: asset.label,
        }
      );

      setTicketPrefillData({
        client_id: asset.client_id,
        site_id: asset.site_id,
        title: generatedData.title,
        description: generatedData.description,
        priority: generatedData.priority,
        source_channel: 'system',
        asset_id: id,
      });
    } else {
      // No probe result, but asset has health issues - create basic ticket
      const prefix = asset.label ? `[${asset.label}] ` : '';
      const title = prefix + (localeCode === 'he'
        ? 'בעיות שזוהו במערכת'
        : 'System Issues Detected');

      const issuesList = healthIssues.length > 0
        ? healthIssues.join('\n• ')
        : (localeCode === 'he' ? 'סטטוס בריאות: ' + healthStatus : 'Health status: ' + healthStatus);

      const description = localeCode === 'he'
        ? `=== דו"ח בעיות מערכת ===\n\n• ${issuesList}\n\n---\nנוצר מסטטוס בריאות שנשמר במערכת`
        : `=== System Issues Report ===\n\n• ${issuesList}\n\n---\nGenerated from persisted health status`;

      setTicketPrefillData({
        client_id: asset.client_id,
        site_id: asset.site_id,
        title,
        description,
        priority: healthStatus === 'critical' ? 'urgent' : healthStatus === 'warning' ? 'high' : 'normal',
        source_channel: 'system',
        asset_id: id,
      });
    }

    setTicketFormOpen(true);
  };

  const handleTicketFormSuccess = (ticketId?: string) => {
    setTicketFormOpen(false);
    setTicketPrefillData(null);
    queryClient.invalidateQueries({ queryKey: ['asset', id] });
    if (ticketId) {
      showSuccess(t('tickets.createSuccess'));
      navigate(`${ticketsBasePath}/${ticketId}`);
    }
  };

  // Check for any disk issues
  const hasDiskIssues = useMemo(() => {
    return disks?.some(d => isDiskStatusBad(d.status)) || false;
  }, [disks]);

  // Time drift check
  const hasTimeDrift = useMemo(() => {
    const driftSeconds = lastProbeResult?.meta?.time_drift_seconds;
    return driftSeconds != null && Math.abs(driftSeconds) > 60;
  }, [lastProbeResult]);

  const timeDriftSeconds = useMemo(() => {
    return lastProbeResult?.meta?.time_drift_seconds ?? 0;
  }, [lastProbeResult]);

  // Check if probe result has any issues that warrant a service ticket
  const hasProbeIssues = useMemo(() => {
    if (!lastProbeResult) return false;

    // Check disk issues
    const diskIssues = lastProbeResult.storage?.disks?.some(
      (d: { status?: string; smart_status?: string }) => {
        const status = d.status?.toLowerCase();
        const smartStatus = d.smart_status?.toLowerCase();
        return (status && status !== 'ok' && status !== 'healthy' && status !== 'normal') ||
               (smartStatus && smartStatus !== 'pass' && smartStatus !== 'ok');
      }
    );

    // Check recording issues
    const hasRecordingIssues = (lastProbeResult.cameras?.recording_missing ?? 0) > 0;

    // Check offline cameras
    const hasOfflineCameras = (lastProbeResult.cameras?.offline ?? 0) > 0;

    // Check overall health status from probe
    const healthStatus = lastProbeResult.health_summary?.overall_status;
    const isUnhealthy = healthStatus && healthStatus !== 'healthy' && healthStatus !== 'ok';

    return diskIssues || hasRecordingIssues || hasOfflineCameras || isUnhealthy;
  }, [lastProbeResult]);

  // Show "Open Service Ticket" button if probe has issues OR asset health is not ok
  const shouldShowServiceTicketButton = useMemo(() => {
    // From probe result
    if (hasProbeIssues) return true;

    // From persisted asset health status
    const status = asset?.health_status;
    if (status && status !== 'ok' && status !== 'unknown') return true;

    return false;
  }, [hasProbeIssues, asset?.health_status]);

  const handleTimeSyncSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['asset', id] });
    showSuccess(t('probe.timeSynced'));
    setTimeout(() => {
      setTimeSyncDialogOpen(false);
    }, 1500);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!asset) {
    return (
      <Alert severity="error">
        {t('app.error')}: Asset not found
      </Alert>
    );
  }

  // Group properties for NVR/DVR
  const networkProps = ['wan_public_ip', 'wan_http_port', 'wan_service_port', 'wan_proto', 'lan_ip_address', 'lan_http_port', 'lan_service_port'];
  const credentialProps = ['device_username', 'device_password'];
  const systemProps = ['max_camera_channels', 'camera_count_connected', 'poe_supported', 'poe_port_count'];
  const groupedKeys = new Set([...networkProps, ...credentialProps, ...systemProps]);

  // Build Web UI URL
  const getWebUiUrl = (): string | null => {
    const wanIp = getProp('wan_public_ip');
    const wanPort = getProp('wan_http_port');
    const proto = getProp('wan_proto') || 'http';
    if (!wanIp) return null;
    const port = wanPort || 80;
    if ((proto === 'http' && port === 80) || (proto === 'https' && port === 443)) {
      return `${proto}://${wanIp}`;
    }
    return `${proto}://${wanIp}:${port}`;
  };

  const webUiUrl = getWebUiUrl();
  const canProbe = getProp('wan_public_ip') && getProp('device_password');

  // Get remaining properties that aren't in groups
  const remainingProperties = asset.properties?.filter(p => !groupedKeys.has(p.key)) || [];

  return (
    <Box>
      {/* ================================================================== */}
      {/* COMPACT HEADER BAR - Mobile/Tablet: 2 rows layout */}
      {/* ================================================================== */}
      <Box sx={{
        mb: 1.5,
        display: 'flex',
        flexDirection: showInlineActions ? 'column' : 'row',
        gap: 1,
      }}>
        {/* Row 1: Navigation + Edit */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}>
          <BackButton fallbackPath={`${basePrefix}/assets`} />
          {canEditAsset && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setEditFormOpen(true)}
            >
              {t('app.edit')}
            </Button>
          )}
        </Box>

        {/* Row 2: Actions Panel (mobile + tablet - inline in header) */}
        {/* Desktop shows actions in sticky sidebar instead */}
        {showInlineActions && isNvrDvr && canProbe && (
          <Box sx={{
            display: 'flex',
            gap: 1,
            justifyContent: isMobile ? 'center' : 'flex-end',
            flexWrap: 'wrap',
          }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={handleProbeDevice}
              disabled={probeMutation.isPending || !canProbe}
              color="primary"
              sx={{ fontSize: '0.75rem', py: 0.5, flexGrow: isMobile ? 1 : 0 }}
            >
              {t('assets.probeDevice')}
            </Button>

            {shouldShowServiceTicketButton && (
              <Button
                variant="contained"
                size="small"
                startIcon={<ConfirmationNumberIcon sx={{ fontSize: 16 }} />}
                onClick={handleOpenServiceTicket}
                color="error"
                sx={{ fontSize: '0.75rem', py: 0.5, flexGrow: isMobile ? 1 : 0 }}
              >
                {t('assets.openServiceTicket')}
              </Button>
            )}

            {hasTimeDrift && (
              <Button
                variant="contained"
                size="small"
                startIcon={<SyncIcon sx={{ fontSize: 16 }} />}
                onClick={() => setTimeSyncDialogOpen(true)}
                color="warning"
                sx={{ fontSize: '0.75rem', py: 0.5, flexGrow: isMobile ? 1 : 0 }}
              >
                {t('probe.timeSync')}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* ================================================================== */}
      {/* REDESIGNED ASSET HEADER - 2 ROW COMPACT LAYOUT */}
      {/* ================================================================== */}
      <Card variant="outlined" sx={{ mb: 1.5 }}>
        <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
          {/* Row 1: Title + Badges */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            mb: 1,
          }}>
            {isSimplifiedType && configResult ? (
              <RouterConfigStatusIcon configResult={configResult} size="medium" />
            ) : (
              <HealthStatusIcon
                status={(asset.health_status as HealthStatus) || 'unknown'}
                issues={asset.health_issues}
                size="medium"
              />
            )}
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {asset.label}
            </Typography>
            <Chip
              label={getAssetTypeName(asset.asset_type_code)}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
            <Chip
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
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
            {asset.has_active_ticket && asset.tickets && asset.tickets.length > 0 && (
              <Tooltip title={t('assets.hasActiveTicket')}>
                <Chip
                  icon={<ConfirmationNumberIcon sx={{ fontSize: 14 }} />}
                  label={t('assets.activeTicket')}
                  size="small"
                  color="info"
                  onClick={() => {
                    const activeTicket = asset.tickets?.find(t => !t.is_closed);
                    if (activeTicket) navigate(`${ticketsBasePath}/${activeTicket.id}`);
                  }}
                  sx={{ height: 22, fontSize: '0.7rem', cursor: 'pointer' }}
                />
              </Tooltip>
            )}
            {hasDiskIssues && (
              <Chip
                icon={<WarningIcon sx={{ fontSize: 14 }} />}
                label={t('assets.diskStatusError')}
                size="small"
                color="error"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          {/* Row 2: Key info grid - compact, tablet-optimized */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',       // Mobile: 2 columns
              sm: 'repeat(3, 1fr)',       // Tablet portrait: 3 columns
              md: 'repeat(4, 1fr)',       // Tablet landscape: 4 columns
              lg: 'repeat(6, 1fr)',       // Desktop: 6 columns
            },
            gap: { xs: 1, sm: 1.25, md: 1.5 },
            pt: 0.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}>
            {/* Serial Number - with truncation */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {t('assets.serialNumber')}
              </Typography>
              <TruncatedSerial
                serial={asset.serial_number}
                onCopy={() => handleCopy(asset.serial_number || '')}
              />
            </Box>

            {/* Install Date */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {t('assets.installDate')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                {asset.install_date ? format(new Date(asset.install_date), 'dd/MM/yyyy') : '—'}
              </Typography>
            </Box>

            {/* Client */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {t('clients.client')}
              </Typography>
              {client ? (
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => navigate(`${clientsBasePath}/${asset.client_id}`)}
                  sx={{ fontWeight: 500, fontSize: '0.9375rem', textAlign: 'start' }}
                >
                  {client.name}
                </Link>
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>—</Typography>
              )}
            </Box>

            {/* Site */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {t('tickets.site')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                {site?.name || '—'}
              </Typography>
            </Box>

            {/* Manufacturer - hidden for simplified types (Router, AP, Switch) */}
            {!isSimplifiedType && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  {t('assets.manufacturer')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                  {asset.manufacturer || '—'}
                </Typography>
              </Box>
            )}

            {/* Model - hidden for simplified types (Router, AP, Switch) */}
            {!isSimplifiedType && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  {t('assets.model')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                  {asset.model || '—'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Notes - if exists, show on separate line */}
          {asset.notes && (
            <Box sx={{ mt: 0.75, pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
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

      {/* ================================================================== */}
      {/* TABS - Compact */}
      {/* ================================================================== */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)} sx={{ minHeight: 32 }}>
          <Tab label={t('assets.properties')} sx={{ minHeight: 32, py: 0.5, fontSize: '0.8rem' }} />
          <Tab label={t('assets.linkedTickets')} sx={{ minHeight: 32, py: 0.5, fontSize: '0.8rem' }} />
          <Tab label={t('activity.title')} sx={{ minHeight: 32, py: 0.5, fontSize: '0.8rem' }} />
        </Tabs>
      </Box>

      {/* ================================================================== */}
      {/* TAB 0: PROPERTIES - REDESIGNED GRID LAYOUT */}
      {/* ================================================================== */}
      {currentTab === 0 && (
        <Box>
          {isNvrDvr && asset.properties && asset.properties.length > 0 ? (
            <Grid container spacing={1}>
              {/* ============================================================ */}
              {/* MAIN COLUMN: Full width on tablet, 9/12 on desktop */}
              {/* Tablet: single column layout with 2-col grids inside cards */}
              {/* ============================================================ */}
              <Grid item xs={12} lg={9}>
                <Stack spacing={1}>
                  {/* -------------------------------------------------------- */}
                  {/* NETWORK & CONNECTION - Tablet-optimized layout */}
                  {/* -------------------------------------------------------- */}
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                      <SectionHeader
                        icon={<RouterIcon sx={{ fontSize: 18 }} />}
                        title={t('assets.networkConnection')}
                        action={
                          webUiUrl && (
                            <Button
                              variant="text"
                              size="small"
                              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              onClick={() => window.open(webUiUrl, '_blank')}
                              sx={{
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                py: 0.25,
                                minHeight: 24,
                              }}
                            >
                              Web UI
                              <Chip
                                label={(getProp('wan_proto') || 'http').toUpperCase()}
                                size="small"
                                sx={{
                                  ml: 0.5,
                                  height: 16,
                                  fontSize: '0.6rem',
                                  '& .MuiChip-label': { px: 0.5 }
                                }}
                                color={(getProp('wan_proto') || 'http') === 'https' ? 'success' : 'default'}
                              />
                            </Button>
                          )
                        }
                      />

                      <Grid container spacing={1.5}>
                        {/* WAN Column */}
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            bgcolor: 'grey.50',
                            borderRadius: 1,
                            p: 1,
                            border: '1px solid',
                            borderColor: 'grey.200',
                            height: '100%',
                          }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 600,
                                color: 'primary.main',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              WAN / {t('assets.externalAccess')}
                            </Typography>
                            {/* Tablet/Desktop: IP full width, ports in row below */}
                            <Box sx={{ mt: 0.75 }}>
                              {/* IP Address - full width */}
                              <Box sx={{ mb: 0.75 }}>
                                <CompactField
                                  label={t('assets.wanIp')}
                                  value={getProp('wan_public_ip')}
                                  monospace
                                  copyable
                                  onCopy={() => handleCopy(getProp('wan_public_ip'))}
                                  truncate={false}
                                />
                              </Box>
                              {/* Ports row - Protocol + Web Port + Service Port */}
                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(3, 1fr)' },
                                gap: 1,
                                alignItems: 'end',
                              }}>
                                <CompactField
                                  label={t('assets.protocol')}
                                  value={(getProp('wan_proto') || 'http').toUpperCase()}
                                />
                                <CompactField label={t('assets.webPort')} value={getProp('wan_http_port') || 80} monospace />
                                <CompactField label={t('assets.servicePort')} value={getProp('wan_service_port') || 8000} monospace />
                              </Box>
                            </Box>
                          </Box>
                        </Grid>

                        {/* LAN Column */}
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            bgcolor: 'grey.50',
                            borderRadius: 1,
                            p: 1,
                            border: '1px solid',
                            borderColor: 'grey.200',
                            height: '100%',
                          }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 600,
                                color: 'primary.main',
                                fontSize: '0.7rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              LAN / {t('assets.internalNetwork')}
                            </Typography>
                            {/* IP full width, ports below */}
                            <Box sx={{ mt: 0.75 }}>
                              {/* IP Address - full width */}
                              <Box sx={{ mb: 0.75 }}>
                                <CompactField
                                  label={t('assets.lanIp')}
                                  value={getProp('lan_ip_address')}
                                  monospace
                                  copyable
                                  onCopy={() => handleCopy(getProp('lan_ip_address'))}
                                  truncate={false}
                                />
                              </Box>
                              {/* Ports row */}
                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: 1,
                                alignItems: 'end',
                              }}>
                                <CompactField label={t('assets.webPort')} value={getProp('lan_http_port') || 80} monospace />
                                <CompactField label={t('assets.servicePort')} value={getProp('lan_service_port') || 8000} monospace />
                              </Box>
                            </Box>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* -------------------------------------------------------- */}
                  {/* CREDENTIALS + SYSTEM SPECS - Tablet: 2-column layout */}
                  {/* -------------------------------------------------------- */}
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                      <Grid container spacing={1.5}>
                        {/* Credentials Section */}
                        <Grid item xs={12} sm={6} md={5}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                            <VpnKeyIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {t('assets.credentials')}
                            </Typography>
                          </Box>
                          <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' },
                            gap: 1.5,
                          }}>
                            <CompactField
                              label={t('assets.deviceUsername')}
                              value={getProp('device_username')}
                              monospace
                              copyable
                              onCopy={() => handleCopy(getProp('device_username'))}
                            />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                {t('assets.devicePassword')}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <Typography
                                  variant="body2"
                                  dir="ltr"
                                  sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: '0.9375rem', textAlign: 'left' }}
                                >
                                  {getProp('device_password')
                                    ? (visibleSecrets.has('device_password') ? getProp('device_password') : '••••••••')
                                    : '—'}
                                </Typography>
                                {getProp('device_password') && (
                                  <>
                                    <IconButton size="small" onClick={() => toggleSecretVisibility('device_password')} sx={{ p: 0.25, opacity: 0.6 }}>
                                      {visibleSecrets.has('device_password') ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleCopy(getProp('device_password'))} sx={{ p: 0.25, opacity: 0.6 }}>
                                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        </Grid>

                        {/* Divider - visible on sm+ as vertical, hidden on mobile */}
                        <Grid item xs={12} sm="auto" sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'stretch' }}>
                          <Divider orientation="vertical" flexItem />
                        </Grid>

                        {/* System Specs Section */}
                        <Grid item xs={12} sm>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                            <SettingsIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {t('assets.systemSpecs')}
                            </Typography>
                          </Box>
                          {/* Tablet: 2x2 grid, Desktop: 4 columns */}
                          <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: 'repeat(2, 1fr)',   // Mobile: 2 columns
                              sm: 'repeat(2, 1fr)',   // Tablet: 2 columns
                              lg: 'repeat(4, 1fr)',   // Desktop: 4 columns
                            },
                            gap: 1,
                          }}>
                            <CompactField label={t('assets.maxChannels')} value={getProp('max_camera_channels')} />
                            <CompactField label={t('assets.connectedCameras')} value={getProp('camera_count_connected')} />
                            <CompactField
                              label={t('assets.poeSupported')}
                              value={
                                getProp('poe_supported') === true ? t('assets.yes') :
                                getProp('poe_supported') === false ? t('assets.no') : '—'
                              }
                            />
                            <CompactField label={t('assets.poePortCount')} value={getProp('poe_port_count')} />
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* -------------------------------------------------------- */}
                  {/* STORAGE / HDD DASHBOARD - Compact table */}
                  {/* -------------------------------------------------------- */}
                  <Card
                    variant="outlined"
                    sx={hasDiskIssues ? { borderColor: 'error.main', borderWidth: 2 } : undefined}
                  >
                    <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 }, position: 'relative' }}>
                      {/* Loading overlay */}
                      {probeMutation.isPending && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                            borderRadius: 1,
                          }}
                        >
                          <Box sx={{ textAlign: 'center' }}>
                            <CircularProgress size={24} />
                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                              {t('assets.probeDevice')}...
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      <SectionHeader
                        icon={<StorageIcon sx={{ fontSize: 18 }} />}
                        title={t('assets.storageHdds')}
                        color={hasDiskIssues ? 'error.main' : 'primary.main'}
                        action={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {hasDiskIssues && (
                              <Chip
                                icon={<WarningIcon sx={{ fontSize: 12 }} />}
                                label={t('assets.diskStatusError')}
                                size="small"
                                color="error"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                              />
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {disks?.length || 0} {t('assets.disks')}
                            </Typography>
                          </Box>
                        }
                      />

                      {disks && disks.length > 0 ? (
                        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Table size="small" sx={{ tableLayout: 'fixed' }}>
                            <TableHead>
                              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                                <TableCell sx={{ fontWeight: 600, width: 40, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 120, py: 0.75, fontSize: '0.8rem' }}>{t('assets.diskSerial')}</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 50, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>TB</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 100, textAlign: 'right', py: 0.75, fontSize: '0.8rem' }}>{t('assets.workingHours')}</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 45, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>°C</TableCell>
                                <TableCell sx={{ fontWeight: 600, width: 80, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>{t('assets.diskStatus')}</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {disks.map((disk) => {
                                const isBad = isDiskStatusBad(disk.status);
                                return (
                                  <TableRow
                                    key={disk.id}
                                    sx={isBad ? {
                                      backgroundColor: 'error.lighter',
                                      '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.12)' },
                                    } : {
                                      '&:hover': { backgroundColor: 'action.hover' },
                                    }}
                                  >
                                    <TableCell sx={{ textAlign: 'center', fontWeight: isBad ? 600 : 400, py: 0.75, fontSize: '0.875rem' }}>
                                      {disk.slot_number || '-'}
                                    </TableCell>
                                    <TableCell sx={{
                                      fontFamily: MONO_FONT,
                                      fontSize: '0.8rem',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontWeight: isBad ? 600 : 400,
                                      py: 0.75,
                                      color: isBad ? 'error.main' : 'inherit',
                                    }}>
                                      {disk.serial_number || '-'}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center', fontWeight: isBad ? 600 : 400, py: 0.75, fontSize: '0.875rem' }}>
                                      {disk.capacity_tb}
                                    </TableCell>
                                    <TableCell sx={{
                                      textAlign: 'right',
                                      fontWeight: isBad ? 600 : 400,
                                      py: 0.75,
                                      color: isBad ? 'error.main' : 'inherit',
                                      fontFamily: MONO_FONT,
                                      fontSize: '0.8rem',
                                    }}>
                                      {formatRuntime(disk.working_hours, locale)}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center', py: 0.75, fontSize: '0.875rem' }}>
                                      {formatTemperature(disk.temperature)}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center', py: 0.75 }}>
                                      <Tooltip title={disk.smart_status ? `S.M.A.R.T.: ${disk.smart_status}` : ''}>
                                        <Chip
                                          icon={isBad ? <ErrorIcon sx={{ fontSize: 14 }} /> : <CheckCircleIcon sx={{ fontSize: 14 }} />}
                                          label={getDiskStatusLabel(disk.status, t)}
                                          size="small"
                                          color={isBad ? 'error' : 'success'}
                                          variant={isBad ? 'filled' : 'outlined'}
                                          sx={{ height: 22, fontSize: '0.75rem', '& .MuiChip-label': { px: 0.75 } }}
                                        />
                                      </Tooltip>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 1.5 }}>
                          {t('assets.noDisks')}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>

                  {/* -------------------------------------------------------- */}
                  {/* CHANNEL STATUS ACCORDION */}
                  {/* -------------------------------------------------------- */}
                  {channels && channels.length > 0 && (
                    <Accordion
                      expanded={channelAccordionExpanded}
                      onChange={(_, expanded) => setChannelAccordionExpanded(expanded)}
                      variant="outlined"
                      sx={{ '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <VideocamIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {t('assets.channelStatus')}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.75, ml: 'auto', mr: 2 }}>
                            {!channelEditMode && (() => {
                              const configuredChannels = channels.filter(ch => ch.is_configured);
                              const activeChannels = configuredChannels.filter(ch => !ch.is_ignored);
                              const onlineCount = activeChannels.filter(ch => ch.is_online).length;
                              const recordingOkCount = activeChannels.filter(ch => ch.has_recording_24h).length;
                              const totalActive = activeChannels.length;

                              return (
                                <>
                                  <Chip
                                    icon={<VideocamIcon sx={{ fontSize: 12 }} />}
                                    label={`${onlineCount}/${totalActive}`}
                                    size="small"
                                    color={onlineCount < totalActive ? 'warning' : 'success'}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                  <Chip
                                    icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                                    label={`${recordingOkCount}/${totalActive} OK`}
                                    size="small"
                                    color={recordingOkCount < totalActive ? 'error' : 'success'}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                </>
                              );
                            })()}
                          </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1 }}>
                        {!channelEditMode && (
                          <Box sx={{ mb: 0.75, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                              onClick={handleEditChannelsClick}
                              variant="outlined"
                              sx={{ fontSize: '0.75rem', py: 0.25 }}
                            >
                              {t('assets.editChannels')}
                            </Button>
                          </Box>
                        )}
                        {channelEditMode && (
                          <Box sx={{ mb: 0.75, display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
                            <Button
                              size="small"
                              startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
                              onClick={handleCancelChannelEdits}
                              variant="outlined"
                              sx={{ fontSize: '0.75rem', py: 0.25 }}
                            >
                              {t('common.cancel')}
                            </Button>
                            <Button
                              size="small"
                              startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
                              onClick={handleSaveChannels}
                              variant="contained"
                              disabled={channelUpdateMutation.isPending}
                              sx={{ fontSize: '0.75rem', py: 0.25 }}
                            >
                              {channelUpdateMutation.isPending ? t('common.saving') : t('common.save')}
                            </Button>
                          </Box>
                        )}
                        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                                <TableCell sx={{ fontWeight: 600, width: 55, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>
                                  {t('assets.channelNumber')}
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, width: channelEditMode ? 140 : 90, py: 0.75, fontSize: '0.8rem' }}>
                                  {t('assets.channelName')}
                                </TableCell>
                                {channelEditMode && (
                                  <TableCell sx={{ fontWeight: 600, width: 170, py: 0.75, fontSize: '0.8rem' }}>
                                    {t('assets.channelNotes')}
                                  </TableCell>
                                )}
                                {!channelEditMode && (
                                  <TableCell sx={{ fontWeight: 600, width: 120, py: 0.75, fontSize: '0.8rem' }} dir="ltr">
                                    {t('assets.channelIp')}
                                  </TableCell>
                                )}
                                <TableCell sx={{ fontWeight: 600, width: 90, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>
                                  {channelEditMode ? t('assets.channelIgnore') : t('assets.channelStatusLabel')}
                                </TableCell>
                                {!channelEditMode && (
                                  <TableCell sx={{ fontWeight: 600, width: 110, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>
                                    {t('assets.recordingStatus')}
                                  </TableCell>
                                )}
                                {!channelEditMode && !isPortalUser && (
                                  <TableCell sx={{ fontWeight: 600, width: 40, textAlign: 'center', py: 0.75, fontSize: '0.8rem' }}>
                                  </TableCell>
                                )}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {channels
                                .filter(ch => ch.is_configured)
                                .map((channel) => {
                                  const edit = channelEdits.get(channel.channel_number);
                                  const isIgnored = edit?.is_ignored ?? channel.is_ignored;
                                  const isOffline = !channel.is_online;
                                  const noRecording = !channel.has_recording_24h;
                                  const hasIssue = !isIgnored && (isOffline || noRecording);

                                  return (
                                    <TableRow
                                      key={channel.channel_number}
                                      sx={{
                                        opacity: isIgnored ? 0.5 : 1,
                                        backgroundColor: hasIssue ? (isOffline ? 'warning.lighter' : 'error.lighter') : undefined,
                                      }}
                                    >
                                      <TableCell sx={{ textAlign: 'center', fontWeight: 500, py: 0.75, fontSize: '0.875rem' }}>
                                        D{channel.channel_number}
                                      </TableCell>
                                      <TableCell sx={{ py: 0.75, fontSize: '0.875rem' }}>
                                        {channelEditMode ? (
                                          <TextField
                                            size="small"
                                            fullWidth
                                            placeholder={channel.name || `D${channel.channel_number}`}
                                            value={edit?.custom_name ?? channel.custom_name ?? ''}
                                            onChange={(e) => handleChannelFieldChange(channel.channel_number, 'custom_name', e.target.value || undefined)}
                                            sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
                                          />
                                        ) : (
                                          channel.custom_name || channel.name || `D${channel.channel_number}`
                                        )}
                                      </TableCell>
                                      {channelEditMode && (
                                        <TableCell sx={{ py: 0.75 }}>
                                          <TextField
                                            size="small"
                                            fullWidth
                                            placeholder={t('assets.channelNotesPlaceholder')}
                                            value={edit?.notes ?? channel.notes ?? ''}
                                            onChange={(e) => handleChannelFieldChange(channel.channel_number, 'notes', e.target.value || undefined)}
                                            sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
                                          />
                                        </TableCell>
                                      )}
                                      {!channelEditMode && (
                                        <TableCell sx={{ fontFamily: MONO_FONT, fontSize: '0.8rem', py: 0.75 }} dir="ltr">
                                          {channel.ip_address || '-'}
                                        </TableCell>
                                      )}
                                      <TableCell sx={{ textAlign: 'center', py: 0.75 }}>
                                        {channelEditMode ? (
                                          <Checkbox
                                            checked={isIgnored}
                                            onChange={(e) => handleChannelFieldChange(channel.channel_number, 'is_ignored', e.target.checked)}
                                            size="small"
                                            sx={{ p: 0.25 }}
                                          />
                                        ) : (
                                          <Chip
                                            icon={channel.is_online ? <VideocamIcon sx={{ fontSize: 12 }} /> : <VideocamOffIcon sx={{ fontSize: 12 }} />}
                                            label={channel.is_online ? t('assets.online') : t('assets.offline')}
                                            size="small"
                                            color={channel.is_online ? 'success' : 'warning'}
                                            variant={channel.is_online ? 'outlined' : 'filled'}
                                            sx={{ height: 22, fontSize: '0.75rem', '& .MuiChip-label': { px: 0.5 } }}
                                          />
                                        )}
                                      </TableCell>
                                      {!channelEditMode && (
                                        <TableCell sx={{ textAlign: 'center', py: 0.75 }}>
                                          <Chip
                                            icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                                            label={channel.has_recording_24h ? t('assets.recordingOk') : t('assets.recordingMissing')}
                                            size="small"
                                            color={channel.has_recording_24h ? 'success' : 'error'}
                                            variant={channel.has_recording_24h ? 'outlined' : 'filled'}
                                            sx={{ height: 22, fontSize: '0.75rem', '& .MuiChip-label': { px: 0.5 } }}
                                          />
                                        </TableCell>
                                      )}
                                      {!channelEditMode && !isPortalUser && (
                                        <TableCell sx={{ textAlign: 'center', py: 0.25 }}>
                                          <Tooltip title={channel.is_online ? t('assets.snapshot') : t('assets.snapshotNotAvailable')}>
                                            <span>
                                              <IconButton
                                                size="small"
                                                onClick={() => handleSnapshotClick(channel.channel_number)}
                                                disabled={!channel.is_online}
                                                sx={{ p: 0.25 }}
                                              >
                                                <CameraAltIcon sx={{ fontSize: 16 }} />
                                              </IconButton>
                                            </span>
                                          </Tooltip>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Additional Properties (if any) */}
                  {remainingProperties.length > 0 && (
                    <Card variant="outlined">
                      <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                        <SectionHeader
                          icon={<InfoOutlinedIcon sx={{ fontSize: 18 }} />}
                          title={t('assets.additionalProperties')}
                        />
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
                          {remainingProperties.map((prop) => (
                            prop.data_type === 'secret' ? (
                              <Box key={prop.key} sx={{ minWidth: 0 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                  {prop.label}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                  <Typography variant="body2" dir="ltr" sx={{ fontFamily: 'monospace', fontWeight: 500, fontSize: '0.9375rem', textAlign: 'left' }}>
                                    {prop.value ? (visibleSecrets.has(prop.key) ? prop.value?.toString() : '••••••••') : '—'}
                                  </Typography>
                                  {prop.value && (
                                    <>
                                      <IconButton size="small" onClick={() => toggleSecretVisibility(prop.key)} sx={{ p: 0.25, opacity: 0.6 }}>
                                        {visibleSecrets.has(prop.key) ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                                      </IconButton>
                                      <IconButton size="small" onClick={() => handleCopy(prop.value?.toString() || '')} sx={{ p: 0.25, opacity: 0.6 }}>
                                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </>
                                  )}
                                </Box>
                              </Box>
                            ) : (
                              <CompactField
                                key={prop.key}
                                label={prop.label}
                                value={
                                  prop.data_type === 'bool' ? (prop.value ? t('assets.yes') : t('assets.no')) :
                                  prop.value?.toString()
                                }
                              />
                            )
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                </Stack>
              </Grid>

              {/* ============================================================ */}
              {/* RIGHT COLUMN: Actions (desktop only - sticky sidebar) */}
              {/* On tablet: actions are shown inline in header */}
              {/* ============================================================ */}
              <Grid item xs={12} lg={3} sx={{ display: { xs: 'none', lg: 'block' } }}>
                <Card
                  variant="outlined"
                  sx={{
                    position: 'sticky',
                    top: 16,
                  }}
                >
                  <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                    <SectionHeader
                      icon={<PlayArrowIcon sx={{ fontSize: 18 }} />}
                      title={t('assets.actionCenter')}
                    />
                    <Stack spacing={0.75}>
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                        onClick={handleProbeDevice}
                        disabled={probeMutation.isPending || !canProbe}
                        color="primary"
                        sx={{ fontSize: '0.8rem', py: 0.75 }}
                      >
                        {t('assets.probeDevice')}
                      </Button>

                      {shouldShowServiceTicketButton && (
                        <Button
                          variant="contained"
                          size="small"
                          fullWidth
                          startIcon={<ConfirmationNumberIcon sx={{ fontSize: 16 }} />}
                          onClick={handleOpenServiceTicket}
                          color="error"
                          sx={{
                            fontSize: '0.8rem',
                            py: 0.75,
                            animation: asset.health_status === 'critical' ? 'pulse 2s ease-in-out infinite' : 'none',
                            '@keyframes pulse': {
                              '0%': { opacity: 1 },
                              '50%': { opacity: 0.7 },
                              '100%': { opacity: 1 },
                            },
                          }}
                        >
                          {t('assets.openServiceTicket')}
                        </Button>
                      )}

                      {hasTimeDrift && (
                        <Button
                          variant="contained"
                          size="small"
                          fullWidth
                          startIcon={<SyncIcon sx={{ fontSize: 16 }} />}
                          onClick={() => setTimeSyncDialogOpen(true)}
                          color="warning"
                          sx={{ fontSize: '0.8rem', py: 0.75 }}
                        >
                          {t('probe.timeSync')}
                        </Button>
                      )}

                      <Divider sx={{ my: 0.5 }} />

                      <Tooltip title={t('assets.comingSoon')}>
                        <span>
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                            disabled
                            color="info"
                            sx={{ fontSize: '0.75rem', py: 0.5 }}
                          >
                            {t('assets.testConnection')}
                          </Button>
                        </span>
                      </Tooltip>

                      <Tooltip title={t('assets.comingSoon')}>
                        <span>
                          <Button
                            variant="outlined"
                            size="small"
                            fullWidth
                            startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
                            disabled
                            color="warning"
                            sx={{ fontSize: '0.75rem', py: 0.5 }}
                          >
                            {t('assets.reboot')}
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : isRouterType && asset.properties && asset.properties.length > 0 ? (
            /* Router assets: Dedicated 4-card layout */
            <RouterDetailsView
              getProp={getProp}
              visibleSecrets={visibleSecrets}
              toggleSecretVisibility={toggleSecretVisibility}
              handleCopy={handleCopy}
              configResult={routerConfigResult!}
            />
          ) : isAccessPointType && asset.properties && asset.properties.length > 0 ? (
            /* Access Point assets: Dedicated layout */
            <AccessPointDetailsView
              getProp={getProp}
              visibleSecrets={visibleSecrets}
              toggleSecretVisibility={toggleSecretVisibility}
              handleCopy={handleCopy}
              configResult={apConfigResult!}
            />
          ) : isSwitchType && asset.properties && asset.properties.length > 0 ? (
            /* Switch assets: Dedicated layout */
            <SwitchDetailsView
              getProp={getProp}
              visibleSecrets={visibleSecrets}
              toggleSecretVisibility={toggleSecretVisibility}
              handleCopy={handleCopy}
              configResult={switchConfigResult!}
            />
          ) : asset.properties && asset.properties.length > 0 ? (
            /* Non-NVR/DVR assets: Show standard property grid */
            <Card variant="outlined">
              <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1 }}>
                  {asset.properties.map((prop) => (
                    prop.data_type === 'secret' ? (
                      <Box key={prop.key} sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, mb: 0.25, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                          {prop.label}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <Typography variant="body2" dir="ltr" sx={{ fontFamily: 'monospace', fontWeight: 500, fontSize: '0.9375rem', textAlign: 'left' }}>
                            {prop.value ? (visibleSecrets.has(prop.key) ? prop.value?.toString() : '••••••••') : '—'}
                          </Typography>
                          {prop.value && (
                            <>
                              <IconButton size="small" onClick={() => toggleSecretVisibility(prop.key)} sx={{ p: 0.25, opacity: 0.6 }}>
                                {visibleSecrets.has(prop.key) ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                              </IconButton>
                              <IconButton size="small" onClick={() => handleCopy(prop.value?.toString() || '')} sx={{ p: 0.25, opacity: 0.6 }}>
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>
                    ) : (
                      <CompactField
                        key={prop.key}
                        label={prop.label}
                        value={
                          prop.data_type === 'bool' ? (prop.value ? t('assets.yes') : t('assets.no')) :
                          prop.value?.toString()
                        }
                      />
                    )
                  ))}
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Card variant="outlined">
              <CardContent sx={{ py: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">{t('assets.noProperties')}</Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* ================================================================== */}
      {/* TAB 1: SERVICE TICKETS */}
      {/* ================================================================== */}
      {currentTab === 1 && (
        <Card variant="outlined">
          {asset.tickets && asset.tickets.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 130, py: 0.75, fontSize: '0.85rem' }}>{t('tickets.ticketNumber')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.85rem' }}>{t('tickets.titleField')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 110, py: 0.75, fontSize: '0.85rem' }}>{t('tickets.status')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 100, py: 0.75, fontSize: '0.85rem' }}>{t('tickets.priority')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 110, py: 0.75, fontSize: '0.85rem' }}>{t('tickets.createdAt')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asset.tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      onClick={() => navigate(`${ticketsBasePath}/${ticket.id}`)}
                      sx={{
                        cursor: 'pointer',
                        opacity: ticket.is_closed ? 0.6 : 1,
                        backgroundColor: ticket.is_closed ? 'action.hover' : 'inherit',
                      }}
                    >
                      <TableCell sx={{
                        fontFamily: MONO_FONT,
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        py: 0.75,
                        color: ticket.is_closed ? 'text.secondary' : 'text.primary',
                        textDecoration: ticket.is_closed ? 'line-through' : 'none'
                      }}>
                        {ticket.ticket_number}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.9rem', py: 0.75, color: ticket.is_closed ? 'text.secondary' : 'text.primary' }}>
                        {ticket.title}
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <Chip
                          label={ticket.status_code || 'unknown'}
                          size="small"
                          color={ticket.is_closed ? 'success' : 'primary'}
                          variant={ticket.is_closed ? 'outlined' : 'filled'}
                          sx={{ height: 22, fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <Chip
                          label={ticket.priority || 'normal'}
                          size="small"
                          color={
                            ticket.is_closed ? 'default' :
                            ticket.priority === 'urgent' ? 'error' :
                            ticket.priority === 'high' ? 'warning' :
                            ticket.priority === 'low' ? 'default' :
                            'info'
                          }
                          variant="outlined"
                          sx={{ height: 22, fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', py: 0.75, color: ticket.is_closed ? 'text.secondary' : 'text.primary' }}>
                        {format(new Date(ticket.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box p={2} textAlign="center">
              <Typography color="text.secondary" fontSize="0.9rem">{t('assets.noServiceTickets')}</Typography>
            </Box>
          )}
        </Card>
      )}

      {/* ================================================================== */}
      {/* TAB 2: ACTIVITY LOG */}
      {/* ================================================================== */}
      {currentTab === 2 && (
        <Card variant="outlined">
          {eventsLoading ? (
            <Box p={2} textAlign="center">
              <CircularProgress size={20} />
            </Box>
          ) : (
            <List disablePadding dense>
              {events && events.length > 0 ? (
                events.map((event, idx) => {
                  const isSystemEvent = event.event_type === 'probe_refresh' ||
                                       event.event_type === 'probe_error' ||
                                       event.event_type === 'created';
                  const isUserAction = event.event_type === 'field_updated' ||
                                      event.event_type === 'property_updated' ||
                                      event.event_type === 'property_set' ||
                                      event.event_type === 'disk_status_changed' ||
                                      event.event_type === 'disk_added' ||
                                      event.event_type === 'disk_removed';

                  return (
                    <React.Fragment key={event.id}>
                      {idx > 0 && <Divider />}
                      <ListItem
                        sx={{
                          py: 0.75,
                          bgcolor: isUserAction ? 'action.hover' : 'transparent',
                          borderLeft: isUserAction ? '3px solid' : 'none',
                          borderLeftColor: isUserAction ? 'primary.main' : 'transparent',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box>
                              <Typography
                                variant="body2"
                                component="span"
                                fontWeight={isUserAction ? 600 : 500}
                                color={isUserAction ? 'primary.main' : 'text.primary'}
                                fontSize="0.8rem"
                              >
                                {event.event_type === 'probe_refresh' && '🔄 System Probe'}
                                {event.event_type === 'probe_error' && '⚠️ Probe Error'}
                                {event.event_type === 'created' && '✨ Created'}
                                {event.event_type === 'field_updated' && '✏️ Field Updated'}
                                {event.event_type === 'property_updated' && '🔧 Property Changed'}
                                {event.event_type === 'property_set' && '➕ Property Added'}
                                {event.event_type === 'disk_status_changed' && '💾 Disk Status'}
                                {event.event_type === 'disk_added' && '💿 Disk Added'}
                                {event.event_type === 'disk_removed' && '🗑️ Disk Removed'}
                                {event.event_type === 'disk_smart_updated' && '📊 SMART Data Updated'}
                                {event.event_type === 'time_synced' && '🕐 Time Synced'}
                                {!['probe_refresh', 'probe_error', 'created', 'field_updated', 'property_updated', 'property_set', 'disk_status_changed', 'disk_added', 'disk_removed', 'disk_smart_updated', 'time_synced'].includes(event.event_type) && event.event_type}
                              </Typography>
                              {event.details && (
                                <Typography
                                  variant="body2"
                                  component="span"
                                  color={isSystemEvent ? 'text.secondary' : 'text.primary'}
                                  sx={{ ml: 1 }}
                                  fontSize="0.8rem"
                                >
                                  — {event.details}
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                              {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm')} • {event.actor_display}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  );
                })
              ) : (
                <Box p={2} textAlign="center">
                  <Typography color="text.secondary" fontSize="0.85rem">{t('activity.noEvents')}</Typography>
                </Box>
              )}
            </List>
          )}
        </Card>
      )}

      {/* ================================================================== */}
      {/* DIALOGS */}
      {/* ================================================================== */}

      {/* Edit Asset Form Dialog */}
      <AssetForm
        open={editFormOpen}
        onClose={() => setEditFormOpen(false)}
        onSuccess={handleEditSuccess}
        assetId={id}
        initialData={asset}
        onDelete={handleDeleteClick}
        canDelete={user?.role === 'admin'}
        isDeletingAsset={usageSummaryQuery.isFetching || deleteMutation.isPending}
      />

      {/* Create Ticket Form Dialog */}
      <TicketForm
        open={ticketFormOpen}
        onClose={() => {
          setTicketFormOpen(false);
          setTicketPrefillData(null);
        }}
        onSuccess={handleTicketFormSuccess}
        prefillData={ticketPrefillData}
        linkAssetId={id}
      />

      {/* Stage 1: Usage Summary Dialog */}
      <Dialog
        open={usageSummaryOpen}
        onClose={() => setUsageSummaryOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('assets.deleteUsageTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('assets.deleteUsageSummary')}
          </DialogContentText>

          <Table size="small" sx={{ mb: 2 }}>
            <TableBody>
              <TableRow>
                <TableCell><strong>{t('assets.usageClient')}:</strong></TableCell>
                <TableCell>{usageSummary?.client_name || '-'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><strong>{t('assets.usageSite')}:</strong></TableCell>
                <TableCell>{usageSummary?.site_name || '-'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            {t('assets.usageTicketsTotal')}:
          </Typography>
          <Table size="small" sx={{ mb: 2 }}>
            <TableBody>
              <TableRow>
                <TableCell>{t('assets.usageTicketsTotal')}</TableCell>
                <TableCell>{usageSummary?.usage.tickets_total || 0}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: usageSummary?.usage.has_open_tickets ? 'error.light' : 'inherit' }}>
                <TableCell>{t('assets.usageTicketsOpen')}</TableCell>
                <TableCell>
                  <strong>{usageSummary?.usage.tickets_open || 0}</strong>
                  {usageSummary?.usage.has_open_tickets && (
                    <Chip icon={<WarningIcon />} label="WARNING" color="error" size="small" sx={{ ml: 1 }} />
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('assets.usageDisks')}</TableCell>
                <TableCell>{usageSummary?.usage.nvr_disks_count || 0}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('assets.usageProperties')}</TableCell>
                <TableCell>{usageSummary?.usage.properties_count || 0}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('assets.usageEvents')}</TableCell>
                <TableCell>{usageSummary?.usage.events_count || 0}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('assets.usageProjects')}</TableCell>
                <TableCell>{usageSummary?.usage.projects_count || 0}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {usageSummary?.usage.nvr_disks && usageSummary.usage.nvr_disks.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'error.main' }}>
                {t('assets.usageDisks')} - {t('assets.willBeDeleted')}:
              </Typography>
              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Slot</TableCell>
                    <TableCell>Serial Number</TableCell>
                    <TableCell>Capacity (GB)</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usageSummary.usage.nvr_disks.map((disk) => (
                    <TableRow key={disk.id}>
                      <TableCell>{disk.slot}</TableCell>
                      <TableCell>{disk.serial_number || '-'}</TableCell>
                      <TableCell>{disk.capacity_gb.toFixed(0)}</TableCell>
                      <TableCell>{disk.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {usageSummary?.usage.has_open_tickets && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('assets.openTicketsWarning', { count: usageSummary.usage.tickets_open })}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsageSummaryOpen(false)} color="inherit">
            {t('app.cancel')}
          </Button>
          <Button
            onClick={handleProceedToFinalConfirm}
            color="error"
            variant="contained"
            startIcon={<WarningIcon />}
          >
            {t('app.continue')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stage 2: Final Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          {t('assets.deleteConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('assets.deleteConfirmMessage', { label: asset?.label })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">
            {t('app.cancel')}
          </Button>
          <Button
            onClick={handleFinalDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleteMutation.isPending ? t('app.loading') : t('assets.deleteButton')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Smart Probe Loader Dialog */}
      <SmartProbeLoader
        open={probeDialogOpen}
        onClose={handleProbeDialogClose}
        onRetry={handleProbeRetry}
        isProbing={probeMutation.isPending}
        probeResult={lastProbeResult}
        probeError={probeError}
        deviceLabel={asset?.label}
      />

      {/* Time Sync Dialog */}
      {id && (
        <TimeSyncDialog
          open={timeSyncDialogOpen}
          onClose={() => setTimeSyncDialogOpen(false)}
          deviceId={id}
          deviceLabel={asset?.label}
          driftSeconds={timeDriftSeconds}
          onSyncSuccess={handleTimeSyncSuccess}
        />
      )}

      {/* Snapshot Preview Dialog */}
      <Dialog
        open={snapshotChannel !== null}
        onClose={handleSnapshotClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          {t('assets.snapshotTitle', { channel: snapshotChannel })}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', minHeight: 200 }}>
          {snapshotLoading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary">
                {t('assets.snapshotLoading')}
              </Typography>
            </Box>
          )}
          {snapshotError && (
            <Alert severity="error" sx={{ my: 2 }}>
              {snapshotError}
            </Alert>
          )}
          {snapshotUrl && (
            <Box
              component="img"
              src={snapshotUrl}
              alt={`Snapshot D${snapshotChannel}`}
              sx={{
                maxWidth: '100%',
                maxHeight: '70vh',
                borderRadius: 1,
                boxShadow: 1,
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSnapshotClose}>
            {t('app.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

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
import { NVRDetailsView } from './NVRDetailsView';
import { NVRAssetHeader } from './NVRAssetHeader';
import { NVRClientSiteRow } from './NVRClientSiteRow';
import { getRouterConfigStatus } from '@/utils/routerConfigStatus';
import { getAPConfigStatus } from '@/utils/accessPointConfigStatus';
import { getSwitchConfigStatus } from '@/utils/switchConfigStatus';
import { TicketForm } from '../Tickets/TicketForm';
import { TimeSyncDialog } from './TimeSyncDialog';
import { CameraSnapshot } from './CameraSnapshot';
import { AssetProperty, AssetUsageSummary, HikvisionProbeResponse, HealthStatus, NVRChannelBulkUpdate, Client, Site, ChannelWithStatus } from '@/types';
import { formatRuntime, formatTemperature } from '@/utils/formatters';
import { SmartProbeLoader } from './SmartProbeLoader';
import {
  isDiskStatusBad,
  getDiskStatusLabel,
} from '@/utils/diskStatus';
import { generateTicketFromProbe } from '@/utils/issueDescriptionGenerator';
import { useResponsive } from '@/hooks/useResponsive';
import { CompactField, TruncatedSerial, SectionHeader, MONO_FONT } from './shared/AssetFieldComponents';

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

  // Snapshot preview state (NVR channel mode)
  const [snapshotChannel, setSnapshotChannel] = useState<number | null>(null);
  // Snapshot preview state (standalone CAMERA mode)
  const [showCameraSnapshot, setShowCameraSnapshot] = useState(false);

  // Copy to clipboard helper
  const handleCopy = async (text: string) => {
    const success = await copyText(text);
    if (success) {
      showSuccess(t('assets.copied'));
    } else {
      showError(t('app.copyError'));
    }
  };

  // NVR channel snapshot handler
  const handleSnapshotClick = (channelNum: number) => {
    setSnapshotChannel(channelNum);
  };

  const handleSnapshotClose = () => {
    setSnapshotChannel(null);
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
  const isCameraType = asset?.asset_type_code === 'CAMERA';
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

        {/* Camera Snapshot button for CAMERA-type assets */}
        {showInlineActions && isCameraType && !isPortalUser && (
          <Box sx={{ display: 'flex', gap: 1, justifyContent: isMobile ? 'center' : 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<CameraAltIcon sx={{ fontSize: 16 }} />}
              onClick={() => setShowCameraSnapshot(true)}
              color="primary"
              sx={{ fontSize: '0.75rem', py: 0.5, flexGrow: isMobile ? 1 : 0 }}
            >
              {t('assets.cameraSnapshot')}
            </Button>
          </Box>
        )}
      </Box>

      {/* ================================================================== */}
      {/* NVR COMMAND CENTER HEADER (for NVR/DVR assets only) */}
      {/* ================================================================== */}
      {isNvrDvr && (
        <>
          <NVRAssetHeader
            asset={asset}
            assetTypeName={getAssetTypeName(asset.asset_type_code)}
            hasDiskIssues={hasDiskIssues}
            onNavigateTicket={(ticketId) => navigate(`${ticketsBasePath}/${ticketId}`)}
            onCopySerial={() => handleCopy(asset.serial_number || '')}
            ticketsBasePath={ticketsBasePath}
          />
          <NVRClientSiteRow
            client={client}
            site={site}
            onNavigateClient={() => navigate(`${clientsBasePath}/${asset.client_id}`)}
          />
        </>
      )}

      {/* ================================================================== */}
      {/* GENERIC ASSET HEADER (for non-NVR assets) */}
      {/* ================================================================== */}
      {!isNvrDvr && <Card variant="outlined" sx={{ mb: 1.5 }}>
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
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                  <Link
                    component="button"
                    onClick={() => navigate(`${clientsBasePath}/${asset.client_id}`)}
                    sx={{ fontWeight: 'inherit', fontSize: 'inherit', textAlign: 'inherit', p: 0, verticalAlign: 'baseline' }}
                  >
                    {client.name}
                  </Link>
                </Typography>
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
              {site?.address && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block' }}>
                  {site.address}
                </Typography>
              )}
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
      </Card>}

      {/* ================================================================== */}
      {/* TABS */}
      {/* ================================================================== */}
      <Box sx={{ mb: 1.5 }}>
        <Tabs
          value={currentTab}
          onChange={(_, v) => setCurrentTab(v)}
          sx={{
            minHeight: 40,
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': {
              minHeight: 40,
              borderRadius: '10px',
              mx: 0.5,
              fontSize: '0.85rem',
              fontWeight: 500,
              textTransform: 'none',
              color: 'text.secondary',
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: '#0a0e17',
                fontWeight: 600,
              },
            },
          }}
        >
          <Tab
            icon={<SettingsIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('assets.properties')}
          />
          <Tab
            icon={<ConfirmationNumberIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('assets.linkedTickets')}
          />
          <Tab
            icon={<InfoOutlinedIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('activity.title')}
          />
        </Tabs>
      </Box>

      {/* ================================================================== */}
      {/* TAB 0: PROPERTIES - REDESIGNED GRID LAYOUT */}
      {/* ================================================================== */}
      {currentTab === 0 && (
        <Box>
          {isNvrDvr && asset.properties && asset.properties.length > 0 ? (
            <NVRDetailsView
              asset={asset}
              getProp={getProp}
              visibleSecrets={visibleSecrets}
              toggleSecretVisibility={toggleSecretVisibility}
              handleCopy={handleCopy}
              webUiUrl={webUiUrl}
              channels={channels}
              channelEditMode={channelEditMode}
              channelEdits={channelEdits}
              onEditChannelsClick={handleEditChannelsClick}
              onCancelChannelEdits={handleCancelChannelEdits}
              onSaveChannels={handleSaveChannels}
              onChannelFieldChange={handleChannelFieldChange}
              channelUpdatePending={channelUpdateMutation.isPending}
              disks={disks}
              hasDiskIssues={hasDiskIssues}
              probePending={probeMutation.isPending}
              canProbe={!!canProbe}
              onProbeDevice={handleProbeDevice}
              shouldShowServiceTicketButton={shouldShowServiceTicketButton}
              onOpenServiceTicket={handleOpenServiceTicket}
              hasTimeDrift={hasTimeDrift}
              onTimeSyncClick={() => setTimeSyncDialogOpen(true)}
              healthStatus={(asset.health_status as HealthStatus) || 'unknown'}
              onSnapshotClick={handleSnapshotClick}
              isPortalUser={isPortalUser}
              events={events}
              remainingProperties={remainingProperties}
              locale={locale}
            />
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

      {/* NVR Channel Snapshot Dialog */}
      <CameraSnapshot
        open={snapshotChannel !== null}
        onClose={handleSnapshotClose}
        nvrAssetId={id}
        channelNumber={snapshotChannel ?? undefined}
        title={snapshotChannel !== null ? t('assets.snapshotTitle', { channel: snapshotChannel }) : undefined}
      />

      {/* Standalone CAMERA Snapshot Dialog */}
      <CameraSnapshot
        open={showCameraSnapshot}
        onClose={() => setShowCameraSnapshot(false)}
        cameraAssetId={id}
        title={asset?.label ? `${t('assets.cameraSnapshot')} - ${asset.label}` : t('assets.cameraSnapshot')}
        autoRefreshSeconds={30}
      />
    </Box>
  );
};

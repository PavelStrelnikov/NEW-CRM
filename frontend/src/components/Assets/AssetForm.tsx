import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  alpha,
} from '@mui/material';
import {
  Refresh as ProbeIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CameraAlt as CameraAltIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { assetsApi } from '@/api/assets';
import { portalAssetsApi } from '@/api/portalAssets';
import { hikvisionApi } from '@/api/hikvision';
import { clientsApi } from '@/api/clients';
import { portalClientsApi } from '@/api/portalClients';
import { useAuth } from '@/contexts/AuthContext';
import {
  AssetCreate,
  AssetUpdate,
  AssetDetailResponse,
  AssetType,
  AssetPropertyDefinition,
  Client,
  Site,
  HikvisionProbeResponse,
  LabelScanResult,
} from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { formatRuntime } from '@/utils/formatters';
import {
  isDiskStatusBad,
  normalizeProbeStatus,
  getDiskStatusColor,
} from '@/utils/diskStatus';
import { SmartProbeLoader } from './SmartProbeLoader';
import { LabelScanPreview } from './LabelScanPreview';
import { useResponsive } from '@/hooks/useResponsive';
import {
  ENUM_OPTIONS,
  HIDDEN_PROPERTY_KEYS,
  HIDDEN_PROPERTY_KEYS_PER_TYPE,
  isPropertyVisible,
  isGroupVisible,
  isKeyGrouped,
  isBasicFieldHidden,
  getGroupsForAssetType,
  type PropertyGroup,
} from '@/constants/propertyFormConfig';

/**
 * Parse max camera channels from Hikvision/HiWatch/HiLook model name.
 *
 * Logic: Find the first numeric block in the model string.
 * The last two digits of that block represent the channel count.
 *
 * Examples:
 * - HWN-4116MH → numeric block "4116" → last 2 digits "16" → 16 channels
 * - NVR-216MH-C → numeric block "216" → last 2 digits "16" → 16 channels
 * - DS-7608NI-K2 → numeric block "7608" → last 2 digits "08" → 8 channels
 * - DS-9632NI-I8 → numeric block "9632" → last 2 digits "32" → 32 channels
 */
function parseMaxChannelsFromModel(model: string | undefined): number | undefined {
  if (!model) return undefined;

  const modelUpper = model.toUpperCase().trim();

  // Find the first numeric block (sequence of digits) in the model name
  const numericBlockMatch = modelUpper.match(/(\d{2,})/);
  if (numericBlockMatch) {
    const numericBlock = numericBlockMatch[1];
    // Get the last 2 digits of the numeric block
    const lastTwoDigits = numericBlock.slice(-2);
    const channels = parseInt(lastTwoDigits, 10);

    // Valid channel counts for NVR/DVR devices
    if ([4, 8, 16, 32, 64, 128].includes(channels)) {
      return channels;
    }
  }

  return undefined;
}


/**
 * Filter out internal PoE network IPs (192.168.254.x).
 * These are used for PoE camera communication and shouldn't be used as the main LAN IP.
 *
 * @param ips - Array of IP addresses from probe
 * @returns First IP that's not in the PoE range, or the first IP if all are PoE
 */
function filterPoENetworkIPs(ips: string[]): string | undefined {
  if (!ips || ips.length === 0) return undefined;

  // Filter out 192.168.254.* (internal PoE camera network)
  const filteredIPs = ips.filter(ip => !ip.startsWith('192.168.254.'));

  // Return first non-PoE IP, or fallback to first IP if all are PoE
  return filteredIPs.length > 0 ? filteredIPs[0] : ips[0];
}


// Local disk type for form state
interface FormDisk {
  id?: string; // undefined for new disks
  slot_number: number | null;
  serial_number: string;
  capacity_tb: number;
  status: string;  // ok, warning, error, unknown
  install_date: string;
  isFromProbe?: boolean;
  // S.M.A.R.T. health data from probe
  working_hours?: number;
  temperature?: number;
  smart_status?: string;  // Pass, Fail, Warning
}

interface AssetFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assetId?: string;
  initialData?: AssetDetailResponse;
  // Pre-selected values for creating assets from client context
  preSelectedClientId?: string;
  preSelectedSiteId?: string;
  // Delete functionality (admin only, edit mode only)
  onDelete?: () => void;
  canDelete?: boolean;
  isDeletingAsset?: boolean;
}

export const AssetForm: React.FC<AssetFormProps> = ({
  open,
  onClose,
  onSuccess,
  assetId,
  initialData,
  preSelectedClientId,
  preSelectedSiteId,
  onDelete,
  canDelete = false,
  isDeletingAsset = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const isPortalUser = user?.user_type === 'portal';
  const isEditMode = !!assetId;

  // Form data state
  const [formData, setFormData] = useState<Partial<AssetCreate & { install_date?: string }>>({
    label: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    install_date: new Date().toISOString().split('T')[0], // Default to today
    status: 'active',
    notes: '',
    properties: {},
  });

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Hikvision probe state
  const [probeResult, setProbeResult] = useState<HikvisionProbeResponse | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [probeHasDiskIssue, setProbeHasDiskIssue] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const toggleSecretVisibility = useCallback((key: string) => {
    setVisibleSecrets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // NVR Disks state
  const [disks, setDisks] = useState<FormDisk[]>([]);

  // Smart Probe Loader state (for validation during create)
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState<Error | null>(null);

  // OCR Label Scan state
  const [labelScanDialogOpen, setLabelScanDialogOpen] = useState(false);
  const [labelScanResult, setLabelScanResult] = useState<LabelScanResult | null>(null);
  const [labelScanError, setLabelScanError] = useState<string | null>(null);
  const [isLabelScanning, setIsLabelScanning] = useState(false);
  const scanFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients-for-assets', isPortalUser],
    queryFn: async (): Promise<{ items: Client[]; total: number }> => {
      if (isPortalUser) {
        const response = await portalClientsApi.list();
        // Convert PortalClient to Client format
        const items: Client[] = response.items.map(pc => ({
          id: pc.id,
          name: pc.name,
          status: pc.is_active ? 'active' : 'inactive',
        } as Client));
        return { items, total: response.total };
      } else {
        return clientsApi.listClients({ page_size: 100 });
      }
    },
    enabled: !!user,
  });

  // Fetch sites for selected client
  const { data: sitesData } = useQuery({
    queryKey: ['sites-for-assets', selectedClient?.id, isPortalUser],
    queryFn: async (): Promise<{ items: Site[]; total: number }> => {
      if (isPortalUser) {
        const response = await portalClientsApi.listSites(selectedClient!.id);
        // Convert PortalSite to Site format
        const items: Site[] = response.items.map(ps => ({
          id: ps.id,
          client_id: ps.client_id,
          name: ps.name,
          address: ps.address,
          city: ps.city,
        } as Site));
        return { items, total: response.total };
      } else {
        return clientsApi.listSites(selectedClient!.id);
      }
    },
    enabled: !!selectedClient && !!user,
  });

  // Fetch asset types
  const { data: assetTypes } = useQuery({
    queryKey: ['asset-types', isPortalUser],
    queryFn: async () => {
      if (isPortalUser) {
        return portalAssetsApi.getAssetTypes();
      } else {
        return assetsApi.listAssetTypes();
      }
    },
    enabled: !!user,
  });

  // Fetch property definitions for selected asset type
  const { data: propertyDefinitions } = useQuery({
    queryKey: ['asset-type-properties', selectedAssetType?.id],
    queryFn: () => assetsApi.getAssetTypeProperties(selectedAssetType!.id),
    enabled: !!selectedAssetType,
  });

  // Fetch existing disks in edit mode
  const { data: existingDisks } = useQuery({
    queryKey: ['asset-disks', assetId, isPortalUser],
    queryFn: async () => {
      if (isPortalUser) {
        return portalAssetsApi.getDisks(assetId!);
      } else {
        return assetsApi.getAssetDisks(assetId!);
      }
    },
    enabled: !!assetId && isEditMode && !!user,
  });

  // Check if this is an NVR or DVR asset type
  const isHikvisionDevice = useMemo(() => {
    return selectedAssetType?.code === 'NVR' || selectedAssetType?.code === 'DVR';
  }, [selectedAssetType]);

  // Check if asset type supports OCR label scanning
  const isOcrScannable = useMemo(() => {
    const code = selectedAssetType?.code;
    return code === 'ROUTER' || code === 'SWITCH' || code === 'ACCESS_POINT';
  }, [selectedAssetType]);

  // Handle client change
  const handleClientChange = (client: Client | null) => {
    setSelectedClient(client);
    setSelectedSite(null);
    setFormData(prev => ({
      ...prev,
      client_id: client?.id,
      site_id: undefined,
    }));
  };

  // Handle site change
  const handleSiteChange = (site: Site | null) => {
    setSelectedSite(site);
    setFormData(prev => ({
      ...prev,
      site_id: site?.id,
    }));
  };

  // Handle asset type change
  const handleAssetTypeChange = (assetType: AssetType | null) => {
    setSelectedAssetType(assetType);
    // Set default property values per asset type
    const isNvrDvr = assetType?.code === 'NVR' || assetType?.code === 'DVR';
    const isSwitch = assetType?.code === 'SWITCH';
    let defaultProps: Record<string, unknown> = {};
    if (isNvrDvr) {
      defaultProps = {
        device_username: 'admin',
        lan_http_port: 80,
        lan_service_port: 8000,
        wan_http_port: 80,
        wan_service_port: 8000,
      };
    } else if (isSwitch) {
      defaultProps = {
        admin_username: 'admin',
      };
    }
    setFormData(prev => ({
      ...prev,
      asset_type_id: assetType?.id,
      properties: defaultProps,
    }));
    setProbeResult(null);
    setProbeError(null);
    setProbeHasDiskIssue(false);
    setDisks([]);
  };

  // Handle property change
  const handlePropertyChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: value,
      },
    }));
  };

  // Disk management functions
  const handleAddDisk = () => {
    const today = new Date().toISOString().split('T')[0];
    setDisks(prev => [...prev, {
      slot_number: prev.length + 1,
      serial_number: '',
      capacity_tb: 1,
      status: 'ok',
      install_date: today,
    }]);
  };

  const handleRemoveDisk = (index: number) => {
    setDisks(prev => prev.filter((_, i) => i !== index));
  };

  const handleDiskChange = (index: number, field: keyof FormDisk, value: any) => {
    setDisks(prev => prev.map((disk, i) =>
      i === index ? { ...disk, [field]: value } : disk
    ));
  };

  // Hikvision probe mutation - uses hybrid SDK + ISAPI approach
  // IMPORTANT: In CREATE mode, pass current formData.properties to avoid stale closure
  const probeMutation = useMutation({
    mutationFn: (currentProperties?: Record<string, any>) => {
      // In edit mode, use probe-and-save to persist disk data to database
      if (assetId) {
        return hikvisionApi.probeAndSaveAsset(assetId);
      }

      // In create mode, use passed properties (avoid stale closure!)
      // currentProperties is passed from handleProbeWithDialog at call time
      const props = currentProperties || {};

      console.log('[probeMutation] CREATE mode - using passed properties:', {
        wan_public_ip: props.wan_public_ip,
        device_password: props.device_password ? '***' : undefined,
        wan_service_port: props.wan_service_port,
        wan_http_port: props.wan_http_port,
        device_username: props.device_username,
      });

      // ===== VALIDATION: Check required fields before API call =====
      const host = props.wan_public_ip;
      const password = props.device_password;

      if (!host || String(host).trim() === '') {
        return Promise.reject(new Error('WAN IP address is required for device probe'));
      }
      if (!password || String(password).trim() === '') {
        return Promise.reject(new Error('Device password is required for probe'));
      }
      // ===== END VALIDATION =====

      // Service Port for SDK connection (default 8000)
      // Ensure ports are numbers - form inputs may be strings
      const servicePort = Number(props.wan_service_port) || 8000;
      // Web Port for ISAPI (default 80, for future use)
      const webPort = Number(props.wan_http_port) || 80;
      const proto = (props.wan_proto as 'http' | 'https') || 'http';

      const probeRequest = {
        host: String(host).trim(),
        port: servicePort,   // Service Port for SDK (must be number)
        web_port: webPort,   // Web Port for ISAPI (must be number)
        username: String(props.device_username || 'admin').trim(),
        password: String(password),
        proto: proto,
      };

      console.log('[probeMutation] Sending probe request:', {
        ...probeRequest,
        password: '***',
      });

      return hikvisionApi.probeDevice(probeRequest);
    },
    onSuccess: (result) => {
      setProbeResult(result);
      setProbeError(null);
      setValidationError(null); // Clear validation error on success

      // Get max_channels from probe, or derive from model name
      const probeModel = result.device?.model;
      let maxChannels = result.device?.maxChannels;
      if (!maxChannels && probeModel) {
        maxChannels = parseMaxChannelsFromModel(probeModel);
        logger.debug(`[AssetForm] max_channels derived from model '${probeModel}': ${maxChannels}`);
      }

      // Filter LAN IPs: exclude 192.168.254.* (PoE camera network)
      const lanIp = filterPoENetworkIPs(result.network?.lan_ips || []);

      // Auto-fill fields from probe result
      setFormData(prev => ({
        ...prev,
        model: probeModel || prev.model,
        serial_number: result.device?.serialNumber || prev.serial_number,
        label: prev.label || result.device?.deviceName || '',
        manufacturer: prev.manufacturer || 'Hikvision',
        properties: {
          ...prev.properties,
          camera_count_connected: result.cameras?.total,
          max_camera_channels: maxChannels || prev.properties?.max_camera_channels,
          lan_ip_address: lanIp || prev.properties?.lan_ip_address,
        },
      }));

      // Auto-fill disks from probe result with S.M.A.R.T. data
      let hasDiskIssue = false;
      if (result.storage?.disks?.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const probeDisks: FormDisk[] = result.storage.disks.map((disk, idx) => {
          // Use shared normalizeProbeStatus with all relevant data
          // This handles: SMART status, working hours > 50k, probe status
          const normalizedStatus = normalizeProbeStatus(
            disk.status,
            disk.smart_status,
            disk.working_hours
          );

          // Check for disk issues (error or warning)
          if (disk.is_critical || normalizedStatus === 'error' || normalizedStatus === 'warning') {
            hasDiskIssue = true;
          }

          return {
            // Use new explicit fields with fallbacks
            slot_number: disk.slot ?? parseInt(disk.id) ?? idx + 1,
            serial_number: disk.serial || disk.model || disk.name || '',
            capacity_tb: disk.capacity_nominal_tb || 0,
            status: normalizedStatus,
            install_date: today,
            isFromProbe: true,
            // S.M.A.R.T. health data (now saved to DB)
            working_hours: disk.working_hours,
            temperature: disk.temperature,
            smart_status: disk.smart_status,
          } as FormDisk;
        });
        setDisks(probeDisks);
      }

      // Store disk issue state for alert display
      setProbeHasDiskIssue(hasDiskIssue);

      // Check time drift and show appropriate message
      const timeDrift = result.meta?.time_drift_seconds;
      const hasTimeDrift = timeDrift !== undefined && Math.abs(timeDrift) > 60;

      // Show success or warning based on disk health and time drift
      if (hasDiskIssue && hasTimeDrift) {
        showError(t('assets.probeWarningDiskAndTime'));
      } else if (hasDiskIssue) {
        showError(t('assets.probeWarningDiskIssue'));
      } else if (hasTimeDrift) {
        showError(t('assets.probeWarningTimeDrift', { seconds: timeDrift }));
      } else {
        showSuccess(t('assets.probeSuccess'));
      }

      // Invalidate parent component's queries so view mode updates
      // This ensures disk data, asset info, and events refresh in the parent view
      if (assetId) {  // Only in edit mode
        queryClient.invalidateQueries({ queryKey: ['asset-disks', assetId] });
        queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
        queryClient.invalidateQueries({ queryKey: ['asset-events', assetId] });
      }
    },
    onError: (error: any) => {
      // Debug: Log full error details to diagnose "Field required" issue
      console.error('[probeMutation] onError - full error:', error);
      console.error('[probeMutation] response status:', error?.response?.status);
      console.error('[probeMutation] response data:', JSON.stringify(error?.response?.data, null, 2));

      // Safely extract error message - handle Pydantic validation errors (array of objects)
      let errorMessage: string;
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Pydantic validation error: [{type, loc, msg, input}, ...]
        console.error('[probeMutation] Pydantic validation errors:', JSON.stringify(detail, null, 2));
        errorMessage = detail.map((e: any) => e.msg || String(e)).join('; ');
      } else if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (typeof detail === 'object' && detail !== null) {
        // Single error object
        errorMessage = detail.msg || detail.message || JSON.stringify(detail);
      } else {
        errorMessage = error?.message || t('assets.probeError');
      }
      setProbeError(errorMessage);
      setValidationError(error); // Store full error for SmartProbeLoader
      setProbeResult(null);
      setProbeHasDiskIssue(false);
    },
  });

  // Handle probe with Smart Loader dialog (for NVR/DVR devices)
  const handleProbeWithDialog = () => {
    console.log('[AssetForm] handleProbeWithDialog called, assetId:', assetId);

    // Pre-validation for create mode: check required fields before opening dialog
    if (!assetId) {
      const props = formData.properties || {};
      console.log('[AssetForm] CREATE mode, props:', {
        wan_public_ip: props.wan_public_ip,
        device_password: props.device_password ? '***' : undefined,
      });
      const missingFields: string[] = [];

      if (!props.wan_public_ip || String(props.wan_public_ip).trim() === '') {
        missingFields.push('WAN IP address');
      }
      if (!props.device_password || String(props.device_password).trim() === '') {
        missingFields.push('Device password');
      }

      if (missingFields.length > 0) {
        console.log('[AssetForm] Missing fields:', missingFields);
        // Show error immediately without calling API
        // Order matters: first set probing state, then error, then open dialog
        setIsProbing(false);
        setValidationError(new Error(`Missing required fields: ${missingFields.join(', ')}`));
        setValidationDialogOpen(true);
        return;
      }
    }

    console.log('[AssetForm] Opening dialog and starting probe...');
    setValidationError(null);
    setValidationDialogOpen(true);
    setIsProbing(true);

    // Pass current properties to avoid stale closure in CREATE mode
    const currentProps = !assetId ? formData.properties : undefined;
    console.log('[AssetForm] Calling probeMutation.mutate() with props:', currentProps ? 'passed' : 'undefined (edit mode)');
    probeMutation.mutate(currentProps, {
      onSettled: () => {
        console.log('[AssetForm] probeMutation settled');
        setIsProbing(false);
      },
    });
  };

  // Close validation dialog and optionally go back to edit
  const handleValidationClose = useCallback(() => {
    setValidationDialogOpen(false);
    setValidationError(null);
  }, []);

  // Retry validation probe
  // Note: includes formData.properties in deps to get fresh values on retry
  const handleValidationRetry = useCallback(() => {
    setValidationError(null);
    setIsProbing(true);
    // Pass current properties to avoid stale closure in CREATE mode
    const currentProps = !assetId ? formData.properties : undefined;
    console.log('[AssetForm] Retry probe with props:', currentProps ? 'passed' : 'undefined (edit mode)');
    probeMutation.mutate(currentProps, {
      onSettled: () => setIsProbing(false),
    });
  }, [probeMutation, assetId, formData.properties]);

  // Go back to form to edit details
  const handleEditDetails = useCallback(() => {
    setValidationDialogOpen(false);
    setValidationError(null);
  }, []);

  // OCR Label Scan mutation
  const scanLabelMutation = useMutation({
    mutationFn: (file: File) => assetsApi.scanLabel(file, selectedAssetType!.code),
    onSuccess: (result) => {
      setLabelScanResult(result);
      setLabelScanError(null);
      setIsLabelScanning(false);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || error?.message || t('assets.ocr.scanErrorDesc');
      setLabelScanError(message);
      setIsLabelScanning(false);
    },
  });

  const handleScanFileSelected = useCallback((files: FileList) => {
    const file = files[0];
    if (!file) return;
    setIsLabelScanning(true);
    setLabelScanResult(null);
    setLabelScanError(null);
    setLabelScanDialogOpen(true);
    scanLabelMutation.mutate(file);
  }, [scanLabelMutation]);

  const handleScanRetry = useCallback(() => {
    setLabelScanDialogOpen(false);
    setLabelScanResult(null);
    setLabelScanError(null);
    scanFileInputRef.current?.click();
  }, []);

  const handleApplyOcrResults = useCallback((mappedValues: {
    properties: Record<string, any>;
    basicFields: Record<string, string>;
  }) => {
    setFormData(prev => ({
      ...prev,
      ...mappedValues.basicFields,
      properties: {
        ...prev.properties,
        ...mappedValues.properties,
      },
    }));
    setLabelScanDialogOpen(false);
    showSuccess(t('assets.ocr.applied'));
  }, [showSuccess, t]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: AssetCreate) => {
      const asset = await assetsApi.createAsset(data);

      // Создаём диски после создания устройства с данными S.M.A.R.T.
      if (disks.length > 0 && asset.id) {
        for (const disk of disks) {
          await assetsApi.createAssetDisk(asset.id, {
            slot_number: disk.slot_number ?? undefined,
            serial_number: disk.serial_number || undefined,
            capacity_tb: disk.capacity_tb,
            install_date: disk.install_date,
            // S.M.A.R.T. данные
            status: disk.status,
            working_hours: disk.working_hours,
            temperature: disk.temperature,
            smart_status: disk.smart_status,
          });
        }
      }

      // ВАЖНО: Если был успешный probe, вызываем probe-and-save
      // для сохранения last_probe_result (включая данные о камерах) в базу
      if (probeResult && probeResult.meta?.success && asset.id) {
        try {
          logger.debug('[AssetForm] Вызываем probe-and-save для сохранения данных probe...');
          await hikvisionApi.probeAndSaveAsset(asset.id);
          logger.debug('[AssetForm] Данные probe сохранены успешно');
        } catch (probeAndSaveError) {
          // Не прерываем создание если probe-and-save упал
          // Устройство уже создано, пользователь может потом обновить probe
          logger.warn('[AssetForm] Не удалось сохранить данные probe:', probeAndSaveError);
        }
      }

      return asset;
    },
    onSuccess: () => {
      showSuccess(t('assets.createSuccess'));
      onSuccess();
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || error?.message || t('app.error'));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: AssetUpdate }) => {
      const asset = await assetsApi.updateAsset(data.id, data.updates);

      // Sync disks: delete removed, update existing, create new
      if (existingDisks) {
        const existingIds = new Set(existingDisks.map(d => d.id));
        const currentIds = new Set(disks.filter(d => d.id).map(d => d.id));

        // Delete removed disks
        for (const existing of existingDisks) {
          if (!currentIds.has(existing.id)) {
            await assetsApi.deleteAssetDisk(data.id, existing.id);
          }
        }

        // Update existing and create new (with S.M.A.R.T. data)
        for (const disk of disks) {
          if (disk.id && existingIds.has(disk.id)) {
            await assetsApi.updateAssetDisk(data.id, disk.id, {
              slot_number: disk.slot_number ?? undefined,  // Convert null to undefined
              serial_number: disk.serial_number || undefined,
              capacity_tb: disk.capacity_tb,
              install_date: disk.install_date,
              // S.M.A.R.T. health data
              status: disk.status,
              working_hours: disk.working_hours,
              temperature: disk.temperature,
              smart_status: disk.smart_status,
            });
          } else if (!disk.id) {
            await assetsApi.createAssetDisk(data.id, {
              slot_number: disk.slot_number ?? undefined,  // Convert null to undefined
              serial_number: disk.serial_number || undefined,
              capacity_tb: disk.capacity_tb,
              install_date: disk.install_date,
              // S.M.A.R.T. health data
              status: disk.status,
              working_hours: disk.working_hours,
              temperature: disk.temperature,
              smart_status: disk.smart_status,
            });
          }
        }
      }

      return asset;
    },
    onSuccess: () => {
      showSuccess(t('assets.updateSuccess'));
      onSuccess();
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || error?.message || t('app.error'));
    },
  });

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id) {
      showError(t('assets.clientRequired'));
      return;
    }
    if (!formData.site_id) {
      showError(t('assets.siteRequired'));
      return;
    }
    if (!formData.asset_type_id) {
      showError(t('assets.typeRequired'));
      return;
    }
    if (!formData.label) {
      showError(t('assets.labelRequired'));
      return;
    }

    if (assetId) {
      const updates: AssetUpdate = {
        label: formData.label,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        serial_number: formData.serial_number || undefined,
        install_date: formData.install_date || undefined,  // Convert empty string to undefined
        status: formData.status,
        notes: formData.notes || undefined,
        properties: formData.properties,
      };
      updateMutation.mutate({ id: assetId, updates });
    } else {
      createMutation.mutate(formData as AssetCreate);
    }
  };

  // Initialize form
  useEffect(() => {
    if (!open) return;

    if (!assetId) {
      // Create mode - reset form with today's date as default
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        label: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        install_date: today,
        status: 'active',
        notes: '',
        properties: {},
      });
      setSelectedClient(null);
      setSelectedSite(null);
      setSelectedAssetType(null);
      setProbeResult(null);
      setProbeError(null);
      setDisks([]);
      setIsInitializing(false);

      // Handle pre-selected client
      if (preSelectedClientId && clientsData?.items) {
        const client = clientsData.items.find(c => c.id === preSelectedClientId);
        if (client) {
          setSelectedClient(client);
          setFormData(prev => ({ ...prev, client_id: client.id }));
        }
      }
    } else if (initialData && clientsData?.items && assetTypes) {
      // Edit mode - populate from initialData
      setIsInitializing(true);

      // Build properties object from initialData.properties array
      const propertiesObj: Record<string, any> = {};
      initialData.properties?.forEach(prop => {
        propertiesObj[prop.key] = prop.value;
      });

      setFormData({
        client_id: initialData.client_id,
        site_id: initialData.site_id,
        asset_type_id: initialData.asset_type_id,
        label: initialData.label || '',
        manufacturer: initialData.manufacturer || '',
        model: initialData.model || '',
        serial_number: initialData.serial_number || '',
        install_date: initialData.install_date || '',
        status: initialData.status || 'active',
        notes: initialData.notes || '',
        properties: propertiesObj,
      });

      // Find and set client
      const client = clientsData.items.find(c => c.id === initialData.client_id);
      if (client) {
        setSelectedClient(client);
      }

      // Find and set asset type
      const assetType = assetTypes.find(t => t.id === initialData.asset_type_id);
      if (assetType) {
        setSelectedAssetType(assetType);
      }
    }
  }, [open, assetId, initialData, clientsData, assetTypes, preSelectedClientId]);

  // Load existing disks in edit mode
  useEffect(() => {
    if (existingDisks && existingDisks.length > 0) {
      setDisks(existingDisks.map(d => ({
        id: d.id,
        slot_number: d.slot_number ?? null,  // Convert undefined to null
        serial_number: d.serial_number || '',
        capacity_tb: d.capacity_tb,
        status: d.status || 'ok',
        install_date: d.install_date,
        // Preserve S.M.A.R.T. data from DB
        working_hours: d.working_hours,
        temperature: d.temperature,
        smart_status: d.smart_status,
      })));
    }
  }, [existingDisks]);

  // Set site after client is loaded (for edit mode or pre-selected site)
  useEffect(() => {
    // Early exit if not initializing in edit mode
    if (!isInitializing || !assetId) {
      // Handle pre-selected site in create mode (separate from edit mode initialization)
      if (!assetId && preSelectedSiteId && selectedClient && !selectedSite && sitesData?.items) {
        const site = sitesData.items.find(s => s.id === preSelectedSiteId);
        if (site) {
          setSelectedSite(site);
          setFormData(prev => ({ ...prev, site_id: site.id }));
        }
      }
      return;
    }

    // Edit mode: wait for sitesData to load, then set site and finish initialization
    if (selectedClient && sitesData?.items) {
      if (initialData?.site_id) {
        const site = sitesData.items.find(s => s.id === initialData.site_id);
        if (site) {
          setSelectedSite(site);
        }
      }
      // Always end initialization when sitesData is available
      setIsInitializing(false);
    }
  }, [isInitializing, selectedClient, selectedSite, sitesData, initialData, assetId, preSelectedSiteId]);

  // Render property field based on data type
  const renderPropertyField = (propDef: AssetPropertyDefinition) => {
    // Скрытые ключи — не отображаем (legacy, избыточные поля)
    if (HIDDEN_PROPERTY_KEYS.has(propDef.key)) {
      return null;
    }

    const value = formData.properties?.[propDef.key] ?? '';
    const label = locale === 'he' ? propDef.label_he : propDef.label_en;

    // Skip connection fields for NVR/DVR - they're rendered separately in Connection Info section
    if (isHikvisionDevice && [
      'wan_public_ip', 'wan_http_port', 'wan_service_port', 'wan_proto',
      'lan_ip_address', 'lan_http_port', 'lan_service_port',
      'device_username', 'device_password'
    ].includes(propDef.key)) {
      return null;
    }

    switch (propDef.data_type) {
      case 'bool':
        return (
          <FormControlLabel
            key={propDef.id}
            control={
              <Checkbox
                checked={!!value}
                onChange={(e) => handlePropertyChange(propDef.key, e.target.checked)}
              />
            }
            label={label}
          />
        );
      case 'int':
        return (
          <TextField
            key={propDef.id}
            fullWidth
            type="number"
            label={label}
            value={value}
            onChange={(e) => handlePropertyChange(propDef.key, parseInt(e.target.value) || 0)}
            required={propDef.required}
            size="small"
          />
        );
      case 'decimal':
        return (
          <TextField
            key={propDef.id}
            fullWidth
            type="number"
            inputProps={{ step: '0.01' }}
            label={label}
            value={value}
            onChange={(e) => handlePropertyChange(propDef.key, parseFloat(e.target.value) || 0)}
            required={propDef.required}
            size="small"
          />
        );
      case 'secret':
        return (
          <TextField
            key={propDef.id}
            fullWidth
            type={visibleSecrets.has(propDef.key) ? 'text' : 'password'}
            label={label}
            value={value}
            onChange={(e) => handlePropertyChange(propDef.key, e.target.value)}
            required={propDef.required}
            size="small"
            inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => toggleSecretVisibility(propDef.key)}
                    edge="end"
                    size="small"
                    sx={{ mr: -0.5 }}
                  >
                    {visibleSecrets.has(propDef.key) ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        );
      case 'date':
        return (
          <TextField
            key={propDef.id}
            fullWidth
            type="date"
            label={label}
            value={value}
            onChange={(e) => handlePropertyChange(propDef.key, e.target.value)}
            required={propDef.required}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        );
      case 'enum': {
        const enumOpts = ENUM_OPTIONS[propDef.key];
        if (enumOpts) {
          return (
            <FormControl key={propDef.id} fullWidth size="small" required={propDef.required}>
              <InputLabel>{label}</InputLabel>
              <Select
                value={value || ''}
                onChange={(e) => handlePropertyChange(propDef.key, e.target.value)}
                label={label}
              >
                {!propDef.required && <MenuItem value="">&mdash;</MenuItem>}
                {enumOpts.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>{t(opt.labelKey)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }
        return (
          <TextField
            key={propDef.id}
            fullWidth
            label={label}
            value={value}
            onChange={(e) => handlePropertyChange(propDef.key, e.target.value)}
            required={propDef.required}
            size="small"
          />
        );
      }
      default: // string
        return (
          <TextField
            key={propDef.id}
            fullWidth
            label={label}
            value={value}
            onChange={(e) => handlePropertyChange(propDef.key, e.target.value)}
            required={propDef.required}
            size="small"
          />
        );
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {isEditMode ? t('assets.editAsset') : t('assets.createAsset')}
        </DialogTitle>
        <DialogContent>
          {isInitializing ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {/* Section: Client & Site */}
              <Typography variant="subtitle2" color="text.secondary">
                {t('assets.locationSection')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    value={selectedClient}
                    onChange={(_, newValue) => handleClientChange(newValue)}
                    options={clientsData?.items || []}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    disabled={isEditMode}
                    renderInput={(params) => (
                      <TextField {...params} label={t('tickets.client') + ' *'} required size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    value={selectedSite}
                    onChange={(_, newValue) => handleSiteChange(newValue)}
                    options={sitesData?.items || []}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    disabled={!selectedClient || isEditMode}
                    renderInput={(params) => (
                      <TextField {...params} label={t('tickets.site') + ' *'} required size="small" />
                    )}
                  />
                </Grid>
              </Grid>

              {/* Section: Asset Type */}
              <Autocomplete
                value={selectedAssetType}
                onChange={(_, newValue) => handleAssetTypeChange(newValue)}
                options={assetTypes || []}
                getOptionLabel={(option) => locale === 'he' ? (option.name_he || option.code) : (option.name_en || option.code)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                disabled={isEditMode}
                renderInput={(params) => (
                  <TextField {...params} label={t('assets.type') + ' *'} required size="small" />
                )}
              />

              <Divider />

              {/* Section: Basic Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('assets.basicInfo')}
                </Typography>
                {isOcrScannable && (
                  <>
                    <input
                      ref={scanFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleScanFileSelected(e.target.files);
                          e.target.value = '';
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CameraAltIcon />}
                      onClick={() => scanFileInputRef.current?.click()}
                      color="secondary"
                    >
                      {t('assets.ocr.scanLabel')}
                    </Button>
                  </>
                )}
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    label={t('assets.label')}
                    value={formData.label}
                    onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                    size="small"
                  />
                </Grid>
                {!isBasicFieldHidden('manufacturer', selectedAssetType?.code) && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('assets.manufacturer')}
                      value={formData.manufacturer}
                      onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                      size="small"
                    />
                  </Grid>
                )}
                {!isBasicFieldHidden('model', selectedAssetType?.code) && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label={t('assets.model')}
                      value={formData.model}
                      onChange={(e) => {
                        const newModel = e.target.value;
                        setFormData(prev => {
                          const updated = { ...prev, model: newModel };
                          // Auto-detect max_channels for NVR/DVR when model changes
                          if (isHikvisionDevice && newModel) {
                            const detectedChannels = parseMaxChannelsFromModel(newModel);
                            if (detectedChannels && !prev.properties?.max_camera_channels) {
                              updated.properties = {
                                ...prev.properties,
                                max_camera_channels: detectedChannels,
                              };
                            }
                          }
                          return updated;
                        });
                      }}
                      size="small"
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('assets.serialNumber')}
                    value={formData.serial_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    size="small"
                    inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label={t('assets.installDate')}
                    value={formData.install_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, install_date: e.target.value }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t('assets.status')}</InputLabel>
                    <Select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      label={t('assets.status')}
                    >
                      <MenuItem value="active">{t('assets.statusActive')}</MenuItem>
                      <MenuItem value="in_repair">{t('assets.statusInRepair')}</MenuItem>
                      <MenuItem value="inactive">{t('assets.statusInactive')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label={t('assets.notes')}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    size="small"
                  />
                </Grid>
              </Grid>

              {/* Section: Hikvision Connection (NVR/DVR only) */}
              {isHikvisionDevice && (
                <>
                  <Divider />
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      {/* Two-column layout for WAN/LAN on tablet+ */}
                      <Grid container spacing={2}>
                        {/* WAN Section */}
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            bgcolor: (theme) => alpha(theme.palette.error.main, 0.06),
                            borderRadius: 1,
                            p: 1.5,
                            border: '1px solid',
                            borderColor: (theme) => alpha(theme.palette.error.main, 0.25),
                            height: '100%',
                          }}>
                            <Typography variant="caption" color="error.main" sx={{ fontWeight: 600, mb: 1.5, display: 'block' }}>
                              WAN / {t('assets.externalAccess')}
                            </Typography>
                            {/* IP Address - full width */}
                            <TextField
                              fullWidth
                              label={t('assets.wanIp')}
                              value={formData.properties?.wan_public_ip || ''}
                              onChange={(e) => handlePropertyChange('wan_public_ip', e.target.value)}
                              size="small"
                              placeholder="1.2.3.4"
                              inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                              sx={{ mb: 1.5 }}
                            />
                            {/* Protocol + Ports row */}
                            <Grid container spacing={1}>
                              <Grid item xs={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>{t('assets.protocol')}</InputLabel>
                                  <Select
                                    value={formData.properties?.wan_proto || 'http'}
                                    onChange={(e) => handlePropertyChange('wan_proto', e.target.value)}
                                    label={t('assets.protocol')}
                                  >
                                    <MenuItem value="http">HTTP</MenuItem>
                                    <MenuItem value="https">HTTPS</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={4}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label={t('assets.webPort')}
                                  value={formData.properties?.wan_http_port ?? 80}
                                  onChange={(e) => handlePropertyChange('wan_http_port', parseInt(e.target.value) || 80)}
                                  size="small"
                                  inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                                />
                              </Grid>
                              <Grid item xs={4}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label={t('assets.servicePort')}
                                  value={formData.properties?.wan_service_port ?? 8000}
                                  onChange={(e) => handlePropertyChange('wan_service_port', parseInt(e.target.value) || 8000)}
                                  size="small"
                                  inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                                />
                              </Grid>
                            </Grid>
                          </Box>
                        </Grid>

                        {/* LAN Section */}
                        <Grid item xs={12} sm={6}>
                          <Box sx={{
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                            borderRadius: 1,
                            p: 1.5,
                            border: '1px solid',
                            borderColor: (theme) => alpha(theme.palette.primary.main, 0.25),
                            height: '100%',
                          }}>
                            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, mb: 1.5, display: 'block' }}>
                              LAN / {t('assets.internalNetwork')}
                            </Typography>
                            {/* IP Address - full width */}
                            <TextField
                              fullWidth
                              label={t('assets.lanIp')}
                              value={formData.properties?.lan_ip_address || ''}
                              onChange={(e) => handlePropertyChange('lan_ip_address', e.target.value)}
                              size="small"
                              placeholder="192.168.1.100"
                              inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                              sx={{ mb: 1.5 }}
                            />
                            {/* Ports row */}
                            <Grid container spacing={1}>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label={t('assets.webPort')}
                                  value={formData.properties?.lan_http_port ?? 80}
                                  onChange={(e) => handlePropertyChange('lan_http_port', parseInt(e.target.value) || 80)}
                                  size="small"
                                  inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                                />
                              </Grid>
                              <Grid item xs={6}>
                                <TextField
                                  fullWidth
                                  type="number"
                                  label={t('assets.servicePort')}
                                  value={formData.properties?.lan_service_port ?? 8000}
                                  onChange={(e) => handlePropertyChange('lan_service_port', parseInt(e.target.value) || 8000)}
                                  size="small"
                                  inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                                />
                              </Grid>
                            </Grid>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Credentials + Probe Button */}
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, mb: 1.5, display: 'block' }}>
                          {t('assets.credentials')}
                        </Typography>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              fullWidth
                              label={t('assets.deviceUsername')}
                              value={formData.properties?.device_username ?? 'admin'}
                              onChange={(e) => handlePropertyChange('device_username', e.target.value)}
                              size="small"
                              inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={5}>
                            <TextField
                              fullWidth
                              type={visibleSecrets.has('device_password') ? 'text' : 'password'}
                              label={t('assets.devicePassword')}
                              value={formData.properties?.device_password || ''}
                              onChange={(e) => handlePropertyChange('device_password', e.target.value)}
                              size="small"
                              inputProps={{ dir: 'ltr', style: { textAlign: 'left' } }}
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      onClick={() => toggleSecretVisibility('device_password')}
                                      edge="end"
                                      size="small"
                                      sx={{ mr: -0.5 }}
                                    >
                                      {visibleSecrets.has('device_password') ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={3}>
                            <Button
                              variant="contained"
                              fullWidth
                              onClick={handleProbeWithDialog}
                              disabled={isProbing || !formData.properties?.wan_public_ip || !formData.properties?.device_password}
                              startIcon={<ProbeIcon />}
                              sx={{ height: '40px' }}
                              color="primary"
                            >
                              {t('assets.probeDevice')}
                            </Button>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* Probe Result */}
                      {probeError && (
                        <Alert severity="error" sx={{ mt: 2 }} icon={<ErrorIcon />}>
                          {probeError}
                        </Alert>
                      )}
                      {probeResult && probeResult.meta && !probeResult.meta.success && (
                        <Alert severity="error" sx={{ mt: 2 }} icon={<ErrorIcon />}>
                          <Typography variant="body2">
                            <strong>{t('assets.probeFailed')}:</strong>{' '}
                            {Object.entries(probeResult.meta.errors || {}).map(([key, value]) => (
                              <span key={key}>{key}: {value}. </span>
                            ))}
                          </Typography>
                        </Alert>
                      )}
                      {/* Результат пробы - только если есть все данные */}
                      {probeResult && probeResult.meta?.success && probeResult.device && probeResult.cameras && probeResult.storage && (
                        <>
                          <Alert
                            severity={probeHasDiskIssue ? "warning" : "success"}
                            sx={{ mt: 2 }}
                            icon={probeHasDiskIssue ? <WarningIcon /> : <SuccessIcon />}
                          >
                            <Typography variant="body2">
                              <strong>{t('assets.device')}:</strong> {probeResult.device?.model || 'Unknown'} ({probeResult.device?.serialNumber || 'N/A'})
                            </Typography>
                            <Typography variant="body2">
                              <strong>{t('assets.cameras')}:</strong>{' '}
                              <span style={{
                                color: (probeResult.cameras?.offline ?? 0) > 0 ? '#ffb347' : 'inherit',
                                fontWeight: (probeResult.cameras?.offline ?? 0) > 0 ? 'bold' : 'normal'
                              }}>
                                {probeResult.cameras?.online ?? 0}/{probeResult.cameras?.total ?? 0} {t('assets.online')}
                              </span>
                              {probeResult.device?.maxChannels && ` (${probeResult.device.maxChannels} max)`}
                            </Typography>
                            <Typography variant="body2">
                              <strong>{t('assets.recording')}:</strong>{' '}
                              <span style={{
                                color: (probeResult.cameras?.recording_missing ?? 0) > 0 ? '#ff4d6a' : '#00d2b4',
                                fontWeight: (probeResult.cameras?.recording_missing ?? 0) > 0 ? 'bold' : 'normal'
                              }}>
                                {probeResult.cameras?.recording_ok ?? 0}/{probeResult.cameras?.total ?? 0} OK
                              </span>
                              {(probeResult.cameras?.recording_missing ?? 0) > 0 && (
                                <span style={{ color: '#ff4d6a' }}>
                                  {' '}({t('assets.recordingMissingCount', { count: probeResult.cameras?.recording_missing ?? 0 })})
                                </span>
                              )}
                            </Typography>
                            <Typography variant="body2">
                              <strong>{t('assets.storage')}:</strong> {probeResult.storage?.disk_count ?? 0} {t('assets.disks')}
                              {probeResult.storage?.disks?.map((disk, idx) => {
                                // Use shared normalizeProbeStatus for consistent status handling
                                const normalizedStatus = normalizeProbeStatus(
                                  disk.status,
                                  disk.smart_status,
                                  disk.working_hours
                                );
                                const isBad = disk.is_critical || normalizedStatus === 'error' || normalizedStatus === 'warning';
                                const statusColors = getDiskStatusColor(normalizedStatus);
                                return (
                                  <span
                                    key={disk.id || idx}
                                    style={{ color: isBad ? statusColors.text : 'inherit', fontWeight: isBad ? 'bold' : 'normal' }}
                                  >
                                    {idx > 0 ? ', ' : ' - '}
                                    {disk.capacity_nominal_tb}TB ({disk.used_percent}% {t('assets.used')}
                                    {disk.working_hours !== undefined && disk.working_hours > 0 &&
                                      `, ${formatRuntime(disk.working_hours, i18n.language)}`}
                                    )
                                    {disk.smart_status && disk.smart_status !== 'Pass' && ` [SMART: ${disk.smart_status}]`}
                                  </span>
                                );
                              })}
                            </Typography>
                          </Alert>
                          {/* Recording + Disk health warning */}
                          {(probeResult.cameras?.recording_missing ?? 0) > 0 && probeHasDiskIssue && (
                            <Alert severity="error" sx={{ mt: 1 }} icon={<WarningIcon />}>
                              <Typography variant="body2">
                                <strong>{t('assets.recordingDiskWarning')}</strong>
                              </Typography>
                            </Alert>
                          )}
                          {/* Time drift warning */}
                          {probeResult.meta?.time_drift_seconds !== undefined &&
                           Math.abs(probeResult.meta.time_drift_seconds) > 60 && (
                            <Alert severity="warning" sx={{ mt: 1 }} icon={<WarningIcon />}>
                              <Typography variant="body2">
                                <strong>{t('assets.timeDrift')}:</strong>{' '}
                                {t('assets.timeDriftMessage', {
                                  seconds: probeResult.meta?.time_drift_seconds,
                                  nvrTime: probeResult.meta?.nvr_time
                                    ? new Date(probeResult.meta.nvr_time).toLocaleTimeString()
                                    : 'N/A'
                                })}
                              </Typography>
                            </Alert>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Section: Storage / HDDs */}
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('assets.storageHdds')}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddDisk}
                    >
                      {t('assets.addDisk')}
                    </Button>
                  </Box>

                  {disks.length > 0 ? (
                    isMobile ? (
                      /* Mobile: Card view for disks */
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {disks.map((disk, index) => {
                          const statusColors = getDiskStatusColor(disk.status);
                          const isBadStatus = isDiskStatusBad(disk.status);
                          return (
                            <Card
                              key={disk.id || `new-${index}`}
                              variant="outlined"
                              sx={{
                                ...(isBadStatus && {
                                  backgroundColor: statusColors.background,
                                  borderColor: statusColors.text,
                                }),
                              }}
                            >
                              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                                {/* Row 1: Slot + Capacity + Status + Delete */}
                                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                    label={t('assets.slotNumber')}
                                    value={disk.slot_number || ''}
                                    onChange={(e) => handleDiskChange(index, 'slot_number', parseInt(e.target.value) || null)}
                                    sx={{ width: 70 }}
                                    inputProps={{ min: 1 }}
                                  />
                                  <TextField
                                    type="number"
                                    size="small"
                                    label={t('assets.capacityTb')}
                                    value={disk.capacity_tb}
                                    onChange={(e) => handleDiskChange(index, 'capacity_tb', parseFloat(e.target.value) || 0)}
                                    sx={{ width: 80 }}
                                    inputProps={{ min: 0, step: 0.5 }}
                                  />
                                  <FormControl size="small" sx={{ minWidth: 100, flex: 1 }}>
                                    <InputLabel>{t('assets.diskStatus')}</InputLabel>
                                    <Select
                                      value={disk.status}
                                      onChange={(e) => handleDiskChange(index, 'status', e.target.value)}
                                      label={t('assets.diskStatus')}
                                    >
                                      <MenuItem value="ok">OK</MenuItem>
                                      <MenuItem value="warning">Warning</MenuItem>
                                      <MenuItem value="error">Error</MenuItem>
                                      <MenuItem value="unknown">Unknown</MenuItem>
                                    </Select>
                                  </FormControl>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveDisk(index)}
                                    color="error"
                                    sx={{ ml: 'auto' }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                                {/* Row 2: Serial Number (full width) */}
                                <TextField
                                  size="small"
                                  fullWidth
                                  label={t('assets.diskSerial')}
                                  value={disk.serial_number}
                                  onChange={(e) => handleDiskChange(index, 'serial_number', e.target.value)}
                                  placeholder={t('assets.diskSerialPlaceholder')}
                                  sx={{ mb: 1 }}
                                />
                                {/* Row 3: Install Date (full width) */}
                                <TextField
                                  type="date"
                                  size="small"
                                  fullWidth
                                  label={t('assets.diskInstallDate')}
                                  value={disk.install_date}
                                  onChange={(e) => handleDiskChange(index, 'install_date', e.target.value)}
                                  InputLabelProps={{ shrink: true }}
                                />
                              </CardContent>
                            </Card>
                          );
                        })}
                      </Box>
                    ) : (
                      /* Desktop/Tablet: Table view for disks */
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: 80 }}>{t('assets.slotNumber')}</TableCell>
                              <TableCell>{t('assets.diskSerial')}</TableCell>
                              <TableCell sx={{ width: 120 }}>{t('assets.capacityTb')}</TableCell>
                              <TableCell sx={{ width: 100 }}>{t('assets.diskStatus')}</TableCell>
                              <TableCell sx={{ width: 140 }}>{t('assets.diskInstallDate')}</TableCell>
                              <TableCell sx={{ width: 50 }}></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {disks.map((disk, index) => {
                              const statusColors = getDiskStatusColor(disk.status);
                              const isBadStatus = isDiskStatusBad(disk.status);
                              return (
                              <TableRow
                                key={disk.id || `new-${index}`}
                                sx={isBadStatus ? {
                                  backgroundColor: statusColors.background,
                                  '& .MuiTableCell-root': { color: statusColors.text },
                                } : undefined}
                              >
                                <TableCell>
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={disk.slot_number || ''}
                                    onChange={(e) => handleDiskChange(index, 'slot_number', parseInt(e.target.value) || null)}
                                    sx={{ width: 60 }}
                                    inputProps={{ min: 1 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    fullWidth
                                    value={disk.serial_number}
                                    onChange={(e) => handleDiskChange(index, 'serial_number', e.target.value)}
                                    placeholder={t('assets.diskSerialPlaceholder')}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={disk.capacity_tb}
                                    onChange={(e) => handleDiskChange(index, 'capacity_tb', parseFloat(e.target.value) || 0)}
                                    sx={{ width: 80 }}
                                    inputProps={{ min: 0, step: 0.5 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <FormControl size="small" fullWidth>
                                    <Select
                                      value={disk.status}
                                      onChange={(e) => handleDiskChange(index, 'status', e.target.value)}
                                    >
                                      <MenuItem value="ok">OK</MenuItem>
                                      <MenuItem value="warning">Warning</MenuItem>
                                      <MenuItem value="error">Error</MenuItem>
                                      <MenuItem value="unknown">Unknown</MenuItem>
                                    </Select>
                                  </FormControl>
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="date"
                                    size="small"
                                    value={disk.install_date}
                                    onChange={(e) => handleDiskChange(index, 'install_date', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveDisk(index)}
                                    color="error"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )
                  ) : (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      {t('assets.noDisksMessage')}
                    </Alert>
                  )}
                </>
              )}

              {/* Section: Dynamic Properties (grouped into Cards) */}
              {/* NVR/DVR — НЕ показываем generic EAV, используем только специализированный layout выше */}
              {!isHikvisionDevice && propertyDefinitions && propertyDefinitions.length > 0 && (() => {
                const propValues = formData.properties || {};
                const defsByKey = new Map(propertyDefinitions.map(d => [d.key, d]));

                // Группы, применимые к текущему asset_type и имеющие хотя бы одно свойство из definitions
                const assetTypeCode = selectedAssetType?.code;
                const applicableGroups = getGroupsForAssetType(assetTypeCode).filter(group =>
                  group.keys.some(k => defsByKey.has(k))
                );

                // Негруппированные свойства (не в группах для данного asset_type и не скрытые)
                const ungroupedDefs = propertyDefinitions.filter(d =>
                  !isKeyGrouped(d.key, assetTypeCode) &&
                  !HIDDEN_PROPERTY_KEYS.has(d.key) &&
                  !(assetTypeCode && HIDDEN_PROPERTY_KEYS_PER_TYPE[assetTypeCode]?.has(d.key))
                );

                // Рендер одной группы в Card
                const renderGroup = (group: PropertyGroup) => {
                  if (!isGroupVisible(group.id, propValues)) return null;

                  const groupDefs = group.keys
                    .map(k => defsByKey.get(k))
                    .filter((d): d is AssetPropertyDefinition => !!d);
                  if (groupDefs.length === 0) return null;

                  const renderedFields = groupDefs
                    .filter(d => isPropertyVisible(d.key, propValues, assetTypeCode))
                    .map(propDef => ({ propDef, element: renderPropertyField(propDef) }))
                    .filter(item => item.element !== null);

                  if (renderedFields.length === 0) return null;

                  return (
                    <Card key={group.id} variant="outlined" sx={{ mb: 1.5 }}>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                          {t(group.titleKey)}
                        </Typography>
                        <Grid container spacing={2}>
                          {renderedFields.map(({ propDef, element }) => (
                            <Grid item xs={12} sm={6} key={propDef.id}>
                              {element}
                            </Grid>
                          ))}
                        </Grid>
                      </CardContent>
                    </Card>
                  );
                };

                const hasGroupedContent = applicableGroups.length > 0;

                const renderedUngrouped = ungroupedDefs
                  .map(propDef => ({ propDef, element: renderPropertyField(propDef) }))
                  .filter(item => item.element !== null);
                const hasUngroupedContent = renderedUngrouped.length > 0;

                if (!hasGroupedContent && !hasUngroupedContent) return null;

                return (
                  <>
                    <Divider />

                    {applicableGroups.map(renderGroup)}

                    {hasUngroupedContent && (
                      <Card variant="outlined" sx={{ mb: 1.5 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          {hasGroupedContent && (
                            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                              {t('assets.propGroup.ungrouped')}
                            </Typography>
                          )}
                          <Grid container spacing={2}>
                            {renderedUngrouped.map(({ propDef, element }) => (
                              <Grid item xs={12} sm={6} key={propDef.id}>
                                {element}
                              </Grid>
                            ))}
                          </Grid>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, display: 'flex', justifyContent: 'space-between' }}>
          {/* Delete button - only in edit mode for admins */}
          {assetId && canDelete && (
            <Button
              color="error"
              variant="outlined"
              onClick={onDelete}
              disabled={isDeletingAsset || isLoading}
              startIcon={<DeleteIcon />}
            >
              {t('app.delete')}
            </Button>
          )}

          {/* Spacer to push Save/Cancel to the right */}
          {!(assetId && canDelete) && <Box sx={{ flex: 1 }} />}

          {/* Save/Cancel buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} disabled={isLoading}>
              {t('app.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
            >
              {isEditMode ? t('app.save') : t('app.create')}
            </Button>
          </Box>
        </DialogActions>
      </form>

      {/* Smart Probe Loader for device validation */}
      {isHikvisionDevice && (
        <SmartProbeLoader
          open={validationDialogOpen}
          onClose={handleValidationClose}
          onRetry={handleValidationRetry}
          onEditDetails={handleEditDetails}
          isProbing={isProbing}
          probeResult={probeResult}
          probeError={validationError}
          mode="validate"
          deviceLabel={formData.label || formData.properties?.wan_public_ip || t('assets.newDevice')}
        />
      )}

      {/* OCR Label Scan Preview */}
      {isOcrScannable && (
        <LabelScanPreview
          open={labelScanDialogOpen}
          onClose={() => setLabelScanDialogOpen(false)}
          scanResult={labelScanResult}
          onApply={handleApplyOcrResults}
          isScanning={isLabelScanning}
          scanError={labelScanError}
          onRetry={handleScanRetry}
        />
      )}
    </Dialog>
  );
};

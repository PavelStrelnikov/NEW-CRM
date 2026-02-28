/**
 * Portal Assets API - for portal users to access assets
 * Uses /api/v1/portal/assets endpoints (with field visibility filtering)
 */
import { apiClient } from './client';
import { AssetDetailResponse, AssetListResponse, NVRDisk, AssetEvent, AssetType } from '../types';

// Types for portal-specific endpoints
export interface NVRChannel {
  channel_number: number;
  custom_name: string | null;
  is_ignored: boolean;
  notes: string | null;
  name: string | null;
  ip_address: string | null;
  is_configured: boolean;
  is_online: boolean;
  has_recording_24h: boolean;
  updated_by_actor_display: string | null;
  updated_at: string | null;
}

export interface PortalChannelUpdate {
  channel_number: number;
  custom_name?: string | null;
  is_ignored: boolean;
  notes?: string | null;
}

export interface PortalAssetCreate {
  site_id: string;
  asset_type_id: string;
  label: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  notes?: string;
  properties?: Record<string, unknown>;
}

export interface PortalAssetUpdate {
  label?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  notes?: string;
  properties?: Record<string, unknown>;
}

export interface ProbeResult {
  success: boolean;
  health_status: string;
  health_issues: string[];
  message: string;
}

export const portalAssetsApi = {
  /**
   * List assets accessible to portal user (filtered by site access)
   */
  list: async (params?: {
    page?: number;
    page_size?: number;
    site_id?: string;
    asset_type_id?: string;
    asset_type?: string;
    search?: string;
    client_id?: string;
  }): Promise<AssetListResponse> => {
    const response = await apiClient.get<AssetListResponse>('/portal/assets', { params });
    return response.data;
  },

  /**
   * Get asset details (with field visibility filtering)
   * Note: Secrets and internal-only fields are filtered by backend
   */
  get: async (assetId: string): Promise<AssetDetailResponse> => {
    const response = await apiClient.get<AssetDetailResponse>(`/portal/assets/${assetId}`);
    return response.data;
  },

  /**
   * List NVR disks for an asset
   */
  getDisks: async (assetId: string): Promise<NVRDisk[]> => {
    const response = await apiClient.get<NVRDisk[]>(`/portal/assets/${assetId}/disks`);
    return response.data;
  },

  /**
   * List NVR channels with customization and live status
   */
  getChannels: async (assetId: string): Promise<NVRChannel[]> => {
    const response = await apiClient.get<NVRChannel[]>(`/portal/assets/${assetId}/channels`);
    return response.data;
  },

  /**
   * List asset events (activity log)
   */
  getEvents: async (assetId: string): Promise<AssetEvent[]> => {
    const response = await apiClient.get<AssetEvent[]>(`/portal/assets/${assetId}/events`);
    return response.data;
  },

  /**
   * List asset types
   */
  getAssetTypes: async (): Promise<AssetType[]> => {
    const response = await apiClient.get<AssetType[]>('/portal/asset-types');
    return response.data;
  },

  /**
   * Create a new asset (CLIENT_ADMIN only)
   */
  create: async (data: PortalAssetCreate): Promise<{ id: string; message: string }> => {
    const response = await apiClient.post<{ id: string; message: string }>('/portal/assets', data);
    return response.data;
  },

  /**
   * Update an asset (CLIENT_ADMIN only)
   */
  update: async (assetId: string, data: PortalAssetUpdate): Promise<{ id: string; message: string }> => {
    const response = await apiClient.patch<{ id: string; message: string }>(`/portal/assets/${assetId}`, data);
    return response.data;
  },

  /**
   * Probe device and save results (CLIENT_ADMIN only)
   */
  probe: async (assetId: string): Promise<ProbeResult> => {
    const response = await apiClient.post<ProbeResult>(`/portal/assets/${assetId}/probe`);
    return response.data;
  },

  /**
   * Bulk update channel customization (CLIENT_ADMIN only)
   */
  bulkUpdateChannels: async (assetId: string, channels: PortalChannelUpdate[]): Promise<void> => {
    await apiClient.post(`/portal/assets/${assetId}/channels/bulk-update`, { channels });
  },
};

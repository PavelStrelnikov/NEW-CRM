import { apiClient } from './client';
import {
  Asset,
  AssetCreate,
  AssetUpdate,
  AssetListResponse,
  AssetDetailResponse,
  AssetType,
  AssetPropertyDefinition,
  AssetUsageSummary,
  AssetEvent,
  NVRDisk,
  NVRDiskCreate,
  NVRDiskUpdate,
  ChannelWithStatus,
  NVRChannelBulkUpdateRequest,
  LabelScanResult,
} from '@/types';

export const assetsApi = {
  listAssets: async (params?: {
    client_id?: string;
    site_id?: string;
    asset_type_id?: string;
    status?: string;
    q?: string;
    page?: number;
    page_size?: number;
  }): Promise<AssetListResponse> => {
    // Filter out empty/undefined params
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([_, v]) => v !== undefined && v !== '')
    );

    const response = await apiClient.get<AssetListResponse>('/assets', {
      params: cleanParams,
    });
    return response.data;
  },

  getAsset: async (id: string): Promise<AssetDetailResponse> => {
    const response = await apiClient.get<AssetDetailResponse>(`/assets/${id}`);
    return response.data;
  },

  createAsset: async (data: AssetCreate): Promise<Asset> => {
    const response = await apiClient.post<Asset>('/assets', data);
    return response.data;
  },

  updateAsset: async (id: string, data: AssetUpdate): Promise<Asset> => {
    const response = await apiClient.patch<Asset>(`/assets/${id}`, data);
    return response.data;
  },

  getAssetUsageSummary: async (id: string): Promise<AssetUsageSummary> => {
    const response = await apiClient.get<AssetUsageSummary>(`/assets/${id}/usage-summary`);
    return response.data;
  },

  deleteAsset: async (id: string): Promise<void> => {
    await apiClient.delete(`/assets/${id}`);
  },

  getAssetEvents: async (id: string): Promise<AssetEvent[]> => {
    const response = await apiClient.get<AssetEvent[]>(`/assets/${id}/events`);
    return response.data;
  },

  listAssetTypes: async (): Promise<AssetType[]> => {
    const response = await apiClient.get<AssetType[]>('/asset-types');
    return response.data;
  },

  getAssetTypeProperties: async (assetTypeId: string): Promise<AssetPropertyDefinition[]> => {
    const response = await apiClient.get<AssetPropertyDefinition[]>(
      `/asset-types/${assetTypeId}/properties`
    );
    return response.data;
  },

  // NVR Disk CRUD operations
  getAssetDisks: async (assetId: string): Promise<NVRDisk[]> => {
    const response = await apiClient.get<NVRDisk[]>(`/assets/${assetId}/disks`);
    return response.data;
  },

  createAssetDisk: async (assetId: string, data: NVRDiskCreate): Promise<NVRDisk> => {
    const response = await apiClient.post<NVRDisk>(`/assets/${assetId}/disks`, data);
    return response.data;
  },

  updateAssetDisk: async (assetId: string, diskId: string, data: NVRDiskUpdate): Promise<NVRDisk> => {
    const response = await apiClient.patch<NVRDisk>(`/assets/${assetId}/disks/${diskId}`, data);
    return response.data;
  },

  deleteAssetDisk: async (assetId: string, diskId: string): Promise<void> => {
    await apiClient.delete(`/assets/${assetId}/disks/${diskId}`);
  },

  // NVR Channel operations
  getChannels: async (assetId: string): Promise<ChannelWithStatus[]> => {
    const response = await apiClient.get<ChannelWithStatus[]>(`/assets/${assetId}/channels`);
    return response.data;
  },

  bulkUpdateChannels: async (assetId: string, data: NVRChannelBulkUpdateRequest): Promise<void> => {
    await apiClient.post(`/assets/${assetId}/channels/bulk-update`, data);
  },

  // OCR Label Scanning
  scanLabel: async (file: File, assetTypeCode: string): Promise<LabelScanResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('asset_type_code', assetTypeCode);

    const response = await apiClient.post<LabelScanResult>(
      '/assets/scan-label',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
    );
    return response.data;
  },

  // Aliases for compatibility with portal API interface
  get list() { return this.listAssets; },
  get get() { return this.getAsset; },
  get create() { return this.createAsset; },
  get update() { return this.updateAsset; },
  get delete() { return this.deleteAsset; },
};

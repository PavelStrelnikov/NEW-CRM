import { apiClient } from './client';
import {
  Asset,
  AssetCreate,
  AssetListResponse,
  AssetDetailResponse,
  AssetType,
} from '@/types';

export const assetsApi = {
  listAssets: async (params?: {
    client_id?: string;
    site_id?: string;
    asset_type?: string;
    q?: string;
    page?: number;
    page_size?: number;
  }): Promise<AssetListResponse> => {
    const response = await apiClient.get<AssetListResponse>('/assets', {
      params,
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

  listAssetTypes: async (): Promise<AssetType[]> => {
    const response = await apiClient.get<AssetType[]>('/asset-types');
    return response.data;
  },
};

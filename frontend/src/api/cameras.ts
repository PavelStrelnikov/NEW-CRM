import { apiClient } from './client';

export interface CameraListItem {
  id: string;
  label: string;
  client_id: string;
  client_name?: string;
  site_id: string;
  site_name?: string;
  manufacturer?: string;
  model?: string;
  status: string;
  camera_protocol?: string;
  camera_channel_number?: number;
  parent_nvr_id?: string;
  parent_nvr_label?: string;
  health_status?: string;
  created_at: string;
  updated_at: string;
}

export interface CameraListResponse {
  items: CameraListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CameraInfoResponse {
  id: string;
  label: string;
  client_id: string;
  client_name?: string;
  site_id: string;
  site_name?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  status: string;
  camera_protocol?: string;
  camera_channel_number?: number;
  camera_stream_type?: string;
  camera_rtsp_url_masked?: string;
  parent_nvr_id?: string;
  parent_nvr_label?: string;
  parent_nvr_health_status?: string;
  health_status?: string;
  created_at: string;
  updated_at: string;
}

export const camerasApi = {
  listCameras: async (params?: {
    client_id?: string;
    site_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<CameraListResponse> => {
    const cleanParams = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '')
    );
    const response = await apiClient.get<CameraListResponse>('/cameras/', { params: cleanParams });
    return response.data;
  },

  getCameraInfo: async (assetId: string): Promise<CameraInfoResponse> => {
    const response = await apiClient.get<CameraInfoResponse>(`/cameras/${assetId}/info`);
    return response.data;
  },

  getSnapshot: async (assetId: string): Promise<Blob> => {
    const response = await apiClient.get(`/cameras/${assetId}/snapshot`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

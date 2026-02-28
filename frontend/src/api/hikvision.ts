import { apiClient } from './client';
import { HikvisionProbeRequest, HikvisionProbeResponse } from '@/types';
import { logger } from '@/utils/logger';

// Типы для синхронизации времени
export interface TimeCheckResponse {
  device_time: string;
  server_time: string;
  drift_seconds: number;
  is_synced: boolean;
  status: 'ok' | 'drift' | 'error';
}

export interface TimeSyncResponse {
  success: boolean;
  message: string;
  device_time_before?: string;
  device_time_after?: string;
  drift_before?: number;
  drift_after?: number;
}

export const hikvisionApi = {
  /**
   * Probe a Hikvision device with explicit credentials.
   * Used by AssetForm during creation/editing.
   */
  probeDevice: async (request: HikvisionProbeRequest): Promise<HikvisionProbeResponse> => {
    // DEBUG: Log exact request body being sent to backend
    console.log('[hikvisionApi.probeDevice] === OUTGOING REQUEST ===');
    console.log('[hikvisionApi.probeDevice] Full request object:', request);
    console.log('[hikvisionApi.probeDevice] JSON body:', JSON.stringify(request, null, 2));
    console.log('[hikvisionApi.probeDevice] host:', request.host, 'type:', typeof request.host);
    console.log('[hikvisionApi.probeDevice] port:', request.port, 'type:', typeof request.port);
    console.log('[hikvisionApi.probeDevice] username:', request.username, 'type:', typeof request.username);
    console.log('[hikvisionApi.probeDevice] password present:', !!request.password, 'length:', request.password?.length);
    console.log('[hikvisionApi.probeDevice] ===========================');

    logger.debug('[Hikvision] Probe request:', logger.maskSensitive(request));
    const response = await apiClient.post<HikvisionProbeResponse>('/hikvision/probe', request);
    logger.debug('[Hikvision] Probe response:', response.data);
    return response.data;
  },

  /**
   * Probe an asset by ID using stored credentials, and auto-save results to DB.
   * Used by AssetDetails "Refresh Status" button.
   * Updates asset properties, model, serial, and NVR disks with S.M.A.R.T. data.
   */
  probeAndSaveAsset: async (assetId: string): Promise<HikvisionProbeResponse> => {
    logger.debug('[Hikvision] Probe and save asset:', assetId);
    const response = await apiClient.post<HikvisionProbeResponse>(
      `/hikvision/assets/${assetId}/probe-and-save`
    );
    logger.debug('[Hikvision] Probe and save response:', response.data);
    return response.data;
  },

  /**
   * Проверить время на устройстве (отдельный вызов без полного probe).
   * Возвращает разницу между временем устройства и сервера.
   */
  checkTime: async (assetId: string): Promise<TimeCheckResponse> => {
    logger.debug('[Hikvision] Check time for asset:', assetId);
    const response = await apiClient.get<TimeCheckResponse>(
      `/hikvision/assets/${assetId}/time`
    );
    logger.debug('[Hikvision] Time check response:', response.data);
    return response.data;
  },

  /**
   * Синхронизировать время на устройстве с серверным временем.
   */
  syncTime: async (assetId: string): Promise<TimeSyncResponse> => {
    logger.debug('[Hikvision] Sync time for asset:', assetId);
    const response = await apiClient.post<TimeSyncResponse>(
      `/hikvision/assets/${assetId}/time/sync`
    );
    logger.debug('[Hikvision] Time sync response:', response.data);
    return response.data;
  },

  /**
   * Get a JPEG snapshot from a specific camera channel.
   * Returns the image as a Blob.
   */
  getSnapshot: async (assetId: string, channel: number): Promise<Blob> => {
    const response = await apiClient.get(
      `/hikvision/assets/${assetId}/channels/${channel}/snapshot`,
      { responseType: 'blob' }
    );
    return response.data;
  },
};

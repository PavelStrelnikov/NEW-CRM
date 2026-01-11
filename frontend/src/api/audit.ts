import { apiClient } from './client';
import { AuditEventListResponse } from '@/types';

export const auditApi = {
  /**
   * List audit events with filters
   */
  listEvents: async (params: {
    entity_type?: string;
    entity_id?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<AuditEventListResponse> => {
    const response = await apiClient.get('/audit-events', { params });
    return response.data;
  },
};

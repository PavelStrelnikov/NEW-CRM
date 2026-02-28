import { apiClient } from './client';
import {
  InternalUser,
  InternalUserCreate,
  InternalUserUpdate,
  InternalUserListResponse,
} from '@/types';

export const usersApi = {
  // List internal users (admin only)
  listInternalUsers: async (params?: {
    q?: string;
    role?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<InternalUserListResponse> => {
    const response = await apiClient.get<{ items: InternalUser[]; total: number }>('/admin/users', {
      params,
    });
    return response.data;
  },

  // Get internal user by ID
  getInternalUser: async (id: string): Promise<InternalUser> => {
    const response = await apiClient.get<InternalUser>(`/admin/users/${id}`);
    return response.data;
  },

  // Create internal user (admin only)
  createInternalUser: async (data: InternalUserCreate): Promise<InternalUser> => {
    const response = await apiClient.post<InternalUser>('/admin/users', data);
    return response.data;
  },

  // Update internal user (admin only)
  updateInternalUser: async (id: string, data: InternalUserUpdate): Promise<InternalUser> => {
    const response = await apiClient.patch<InternalUser>(`/admin/users/${id}`, data);
    return response.data;
  },

  // Assign ticket to technician (admin only)
  assignTicket: async (ticketId: string, data: { assigned_to_internal_user_id: string; reason?: string }): Promise<any> => {
    const response = await apiClient.post(`/tickets/${ticketId}/assign`, data);
    return response.data;
  },

  // Get unassigned tickets (admin only)
  getUnassignedTickets: async (params?: { limit?: number; offset?: number }): Promise<any> => {
    const response = await apiClient.get('/tickets/unassigned', { params });
    return response.data;
  },

  // Get technician's assigned tickets
  getMyAssignedTickets: async (params?: { limit?: number; offset?: number }): Promise<any> => {
    const response = await apiClient.get('/tickets/me/assigned', { params });
    return response.data;
  },
};

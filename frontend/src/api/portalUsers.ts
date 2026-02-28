/**
 * Portal Users API (CLIENT_ADMIN, CLIENT_USER, CLIENT_CONTACT management)
 */

import { apiClient } from './client';

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: 'CLIENT_ADMIN' | 'CLIENT_USER' | 'CLIENT_CONTACT';
  client_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalUserCreate {
  email: string;
  name: string;
  password: string;
  role: 'CLIENT_ADMIN' | 'CLIENT_USER' | 'CLIENT_CONTACT';
  client_id: string;
  is_active?: boolean;
}

export interface PortalUserUpdate {
  name?: string;
  email?: string;
  role?: 'CLIENT_ADMIN' | 'CLIENT_USER' | 'CLIENT_CONTACT';
  is_active?: boolean;
}

export interface ClientAssignment {
  user_id: string;
  email: string;
  role: string;
  primary_client_id: string;
  primary_client_name: string;
  assigned_client_ids: string[];
  assigned_clients: Array<{ id: string; name: string }>;
}

export interface UpdateClientAssignmentsRequest {
  client_ids: string[];
}

export const portalUsersApi = {
  /**
   * List all portal users (CLIENT_ADMIN, CLIENT_USER, CLIENT_CONTACT)
   */
  list: async (params?: {
    q?: string;
    role?: string;
    client_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ items: PortalUser[]; total: number }> => {
    const response = await apiClient.get<{ items: PortalUser[]; total: number }>('/admin/portal/client-users', {
      params,
    });
    return response.data;
  },

  /**
   * Get portal user by ID
   */
  get: async (userId: string): Promise<PortalUser> => {
    const response = await apiClient.get<PortalUser>(`/admin/portal/client-users/${userId}`);
    return response.data;
  },

  /**
   * Create new portal user
   */
  create: async (data: PortalUserCreate): Promise<PortalUser> => {
    const response = await apiClient.post<PortalUser>('/admin/portal/client-users', data);
    return response.data;
  },

  /**
   * Update portal user
   */
  update: async (userId: string, data: PortalUserUpdate): Promise<PortalUser> => {
    const response = await apiClient.patch<PortalUser>(`/admin/portal/client-users/${userId}`, data);
    return response.data;
  },

  /**
   * Delete portal user
   */
  delete: async (userId: string): Promise<void> => {
    await apiClient.delete(`/admin/portal/client-users/${userId}`);
  },

  /**
   * Get client assignments for a CLIENT_ADMIN user
   */
  getClientAssignments: async (userId: string): Promise<ClientAssignment> => {
    const response = await apiClient.get<ClientAssignment>(`/admin/portal/client-users/${userId}/clients`);
    return response.data;
  },

  /**
   * Update client assignments for a CLIENT_ADMIN user
   */
  updateClientAssignments: async (
    userId: string,
    data: UpdateClientAssignmentsRequest
  ): Promise<{ status: string; message: string; assigned_client_count: number }> => {
    const response = await apiClient.put<{
      status: string;
      message: string;
      assigned_client_count: number;
    }>(`/admin/portal/client-users/${userId}/clients`, data);
    return response.data;
  },
};

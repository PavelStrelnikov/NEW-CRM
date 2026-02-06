/**
 * Portal Auth API - for client users (CLIENT_ADMIN, CLIENT_USER, CLIENT_CONTACT)
 * Uses /api/v1/portal/auth/* endpoints
 */
import { apiClient } from './client';
import { LoginRequest, TokenResponse, User } from '@/types';

export const portalAuthApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    // Portal users use /portal/auth/login endpoint
    // Backend will return correct token with allowed_client_ids for CLIENT_ADMIN
    const response = await apiClient.post<TokenResponse>('/portal/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    // Portal users use /portal/auth/me endpoint
    const response = await apiClient.get<User>('/portal/auth/me');
    return response.data;
  },

  switchClient: async (clientId: string): Promise<{ access_token: string; client_id: string; client_name: string }> => {
    // Switch active client for CLIENT_ADMIN users
    const response = await apiClient.post('/portal/auth/switch-client', { client_id: clientId });
    return response.data;
  },
};

// Deprecated: Use portalAuthApi or adminAuthApi directly
// This export is kept for backward compatibility but will be removed
export const authApi = portalAuthApi;

/**
 * Admin Auth API - for internal users (admin, technician, office)
 * Uses /api/v1/auth/* endpoints
 */
import { apiClient } from './client';
import { LoginRequest, TokenResponse, User } from '@/types';

export const adminAuthApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    // Internal users use /auth/login endpoint
    const response = await apiClient.post<TokenResponse>('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getCurrentUser: async (): Promise<User> => {
    // Internal users use /auth/me endpoint
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};

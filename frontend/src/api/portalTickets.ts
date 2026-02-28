/**
 * Portal Tickets API - for portal users to access tickets
 * Uses /api/v1/portal/tickets endpoints
 */
import { apiClient } from './client';
import { Ticket, TicketListResponse, TicketCreate, WorkLog } from '../types';

export const portalTicketsApi = {
  /**
   * List tickets accessible to portal user (filtered by site access)
   */
  list: async (params?: {
    page?: number;
    page_size?: number;
    status_id?: string;
    priority?: string;
    site_id?: string;
    search?: string;
  }): Promise<TicketListResponse> => {
    const response = await apiClient.get<TicketListResponse>('/portal/tickets', { params });
    return response.data;
  },

  /**
   * Get ticket details
   */
  get: async (ticketId: string): Promise<Ticket> => {
    const response = await apiClient.get<Ticket>(`/portal/tickets/${ticketId}`);
    return response.data;
  },

  /**
   * Create ticket (portal users can create tickets)
   */
  create: async (data: TicketCreate): Promise<Ticket> => {
    const response = await apiClient.post<Ticket>('/portal/tickets', data);
    return response.data;
  },

  /**
   * List work logs (activities) for a ticket
   * Read-only access for portal users
   */
  listWorkLogs: async (ticketId: string): Promise<WorkLog[]> => {
    const response = await apiClient.get<WorkLog[]>(`/portal/tickets/${ticketId}/worklogs`);
    return response.data;
  },
};

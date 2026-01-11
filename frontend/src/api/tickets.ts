import { apiClient } from './client';
import {
  Ticket,
  TicketCreate,
  TicketListResponse,
  TicketDetailResponse,
  WorkLogCreate,
  WorkLog,
  LineItemCreate,
  LineItem,
} from '@/types';

export const ticketsApi = {
  listTickets: async (params?: {
    client_id?: string;
    site_id?: string;
    status_id?: string;
    assigned_to?: string;
    category?: string;
    priority?: string;
    q?: string;
    page?: number;
    page_size?: number;
  }): Promise<TicketListResponse> => {
    const response = await apiClient.get<TicketListResponse>('/tickets', {
      params,
    });
    return response.data;
  },

  getTicket: async (id: string): Promise<TicketDetailResponse> => {
    const response = await apiClient.get<TicketDetailResponse>(`/tickets/${id}`);
    return response.data;
  },

  createTicket: async (data: TicketCreate): Promise<TicketDetailResponse> => {
    const response = await apiClient.post<TicketDetailResponse>('/tickets', data);
    return response.data;
  },

  // Work Logs
  createWorkLog: async (ticketId: string, data: WorkLogCreate): Promise<WorkLog> => {
    const response = await apiClient.post<WorkLog>(
      `/tickets/${ticketId}/work-logs`,
      data
    );
    return response.data;
  },

  // Line Items
  createLineItem: async (ticketId: string, data: LineItemCreate): Promise<LineItem> => {
    const response = await apiClient.post<LineItem>(
      `/tickets/${ticketId}/line-items`,
      data
    );
    return response.data;
  },
};

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
  TicketStatus,
  TicketCategory,
} from '@/types';

export const ticketsApi = {
  // Reference data
  listTicketStatuses: async (): Promise<TicketStatus[]> => {
    const response = await apiClient.get<TicketStatus[]>('/admin/ticket-statuses');
    return response.data;
  },

  listTicketCategories: async (): Promise<TicketCategory[]> => {
    const response = await apiClient.get<TicketCategory[]>('/admin/ticket-categories');
    return response.data;
  },

  // Update ticket category
  updateCategory: async (ticketId: string, categoryId: string | null): Promise<Ticket> => {
    const response = await apiClient.patch<Ticket>(`/tickets/${ticketId}`, {
      category_id: categoryId,
    });
    return response.data;
  },

  listTickets: async (params?: {
    client_id?: string;
    site_id?: string;
    status?: string;
    assigned_to?: string;
    category?: string;
    priority?: string;
    q?: string;
    // Date range filters
    date_from?: string; // ISO date string (YYYY-MM-DD)
    date_to?: string;   // ISO date string (YYYY-MM-DD)
    // Hide closed tickets
    hide_closed?: boolean;
    // Sorting
    sort_by?: 'created_at' | 'ticket_number' | 'priority' | 'status' | 'updated_at';
    sort_order?: 'asc' | 'desc';
    // Pagination
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

  updateTicket: async (id: string, data: any): Promise<Ticket> => {
    const response = await apiClient.patch<Ticket>(`/tickets/${id}`, data);
    return response.data;
  },

  // Change ticket status (requires POST to /tickets/{id}/status)
  changeStatus: async (ticketId: string, statusId: string, comment?: string): Promise<Ticket> => {
    const response = await apiClient.post<Ticket>(`/tickets/${ticketId}/status`, {
      status_id: statusId,
      comment,
    });
    return response.data;
  },

  // Assign ticket to a technician (requires POST to /tickets/{id}/assign)
  assignTicket: async (ticketId: string, userId: string | null, reason?: string): Promise<any> => {
    if (userId === null) {
      // To unassign, we need to use PATCH endpoint - backend doesn't support unassign via assign endpoint
      // For now, return error - unassign is not directly supported
      throw new Error('Unassign not supported via this endpoint');
    }
    const response = await apiClient.post(`/tickets/${ticketId}/assign`, {
      assigned_to_internal_user_id: userId,
      reason,
    });
    return response.data;
  },

  // Work Logs (Activities)
  listWorkLogs: async (ticketId: string): Promise<WorkLog[]> => {
    const response = await apiClient.get<WorkLog[]>(`/tickets/${ticketId}/worklogs`);
    return response.data;
  },

  createWorkLog: async (ticketId: string, data: WorkLogCreate): Promise<WorkLog> => {
    const response = await apiClient.post<WorkLog>(
      `/tickets/${ticketId}/worklogs`,
      data
    );
    return response.data;
  },

  updateWorkLog: async (workLogId: string, data: any): Promise<WorkLog> => {
    const response = await apiClient.patch<WorkLog>(`/worklogs/${workLogId}`, data);
    return response.data;
  },

  deleteWorkLog: async (workLogId: string): Promise<void> => {
    await apiClient.delete(`/worklogs/${workLogId}`);
  },

  // Line Items
  createLineItem: async (ticketId: string, data: LineItemCreate): Promise<LineItem> => {
    const response = await apiClient.post<LineItem>(
      `/tickets/${ticketId}/line-items`,
      data
    );
    return response.data;
  },

  // Ticket-Asset Links
  linkAssetToTicket: async (ticketId: string, assetId: string, relationType: string = 'affected'): Promise<void> => {
    await apiClient.post(`/tickets/${ticketId}/assets`, {
      asset_id: assetId,
      relation_type: relationType,
    });
  },

  getLinkedAssets: async (ticketId: string): Promise<any[]> => {
    const response = await apiClient.get(`/tickets/${ticketId}/assets`);
    return response.data;
  },
};

// Aliases for compatibility with portal API interface
ticketsApi.list = ticketsApi.listTickets;
ticketsApi.get = ticketsApi.getTicket;
ticketsApi.create = ticketsApi.createTicket;
ticketsApi.update = ticketsApi.updateTicket;

import { apiClient } from './client';
import {
  Client,
  ClientCreate,
  ClientUpdate,
  ClientListResponse,
  ClientDeletionSummary,
  Site,
  SiteCreate,
  SiteUpdate,
  SiteListResponse,
  SiteDeletionSummary,
  Contact,
  ContactCreate,
  ContactUpdate,
  ContactListResponse,
  DeletionResponse,
} from '@/types';

export const clientsApi = {
  // Clients
  listClients: async (params?: {
    q?: string;
    include_inactive?: boolean;
    sort?: string;
    order?: string;
    page?: number;
    page_size?: number;
  }): Promise<ClientListResponse> => {
    const response = await apiClient.get<ClientListResponse>('/clients', {
      params,
    });
    return response.data;
  },

  getClient: async (id: string): Promise<Client> => {
    const response = await apiClient.get<Client>(`/clients/${id}`);
    return response.data;
  },

  createClient: async (data: ClientCreate): Promise<Client> => {
    const response = await apiClient.post<Client>('/clients', data);
    return response.data;
  },

  updateClient: async (id: string, data: ClientUpdate): Promise<Client> => {
    const response = await apiClient.patch<Client>(`/clients/${id}`, data);
    return response.data;
  },

  getClientDeletionSummary: async (id: string): Promise<ClientDeletionSummary> => {
    const response = await apiClient.get<ClientDeletionSummary>(`/clients/${id}/deletion-summary`);
    return response.data;
  },

  deleteClient: async (id: string, force: boolean = false): Promise<DeletionResponse> => {
    const response = await apiClient.delete<DeletionResponse>(`/clients/${id}`, {
      params: { force },
    });
    return response.data;
  },

  // Sites
  listSites: async (clientId: string): Promise<SiteListResponse> => {
    const response = await apiClient.get<Site[]>(`/clients/${clientId}/sites`);
    return { items: response.data, total: response.data.length };
  },

  getSite: async (siteId: string): Promise<Site> => {
    const response = await apiClient.get<Site>(`/sites/${siteId}`);
    return response.data;
  },

  createSite: async (clientId: string, data: SiteCreate): Promise<Site> => {
    const response = await apiClient.post<Site>(`/clients/${clientId}/sites`, data);
    return response.data;
  },

  updateSite: async (siteId: string, data: SiteUpdate): Promise<Site> => {
    const response = await apiClient.patch<Site>(`/sites/${siteId}`, data);
    return response.data;
  },

  getSiteDeletionSummary: async (siteId: string): Promise<SiteDeletionSummary> => {
    const response = await apiClient.get<SiteDeletionSummary>(`/sites/${siteId}/deletion-summary`);
    return response.data;
  },

  deleteSite: async (siteId: string, force: boolean = false): Promise<DeletionResponse> => {
    const response = await apiClient.delete<DeletionResponse>(`/sites/${siteId}`, {
      params: { force },
    });
    return response.data;
  },

  // Contacts
  listContacts: async (clientId: string): Promise<ContactListResponse> => {
    const response = await apiClient.get<Contact[]>(`/clients/${clientId}/contacts`);
    return { items: response.data, total: response.data.length };
  },

  getContact: async (contactId: string): Promise<Contact> => {
    const response = await apiClient.get<Contact>(`/contacts/${contactId}`);
    return response.data;
  },

  createContact: async (clientId: string, data: ContactCreate): Promise<Contact> => {
    const response = await apiClient.post<Contact>(`/clients/${clientId}/contacts`, data);
    return response.data;
  },

  updateContact: async (contactId: string, data: ContactUpdate): Promise<Contact> => {
    const response = await apiClient.patch<Contact>(`/contacts/${contactId}`, data);
    return response.data;
  },
};

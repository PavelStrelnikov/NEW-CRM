/**
 * Portal Clients API - for portal users to access their assigned clients
 * Uses /api/v1/portal/clients endpoints
 */
import { apiClient } from './client';

export interface PortalClient {
  id: string;
  name: string;
  is_active: boolean;
  is_primary: boolean; // True if this is the user's primary client
}

export interface PortalSite {
  id: string;
  client_id: string;
  name: string;
  address?: string;
}

export interface PortalClientsListResponse {
  items: PortalClient[];
  total: number;
}

export interface PortalSitesListResponse {
  items: PortalSite[];
  total: number;
}

export interface PortalContact {
  id: string;
  client_id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  notes?: string;
  applies_to_all_sites: boolean;
}

export interface PortalContactsListResponse {
  items: PortalContact[];
  total: number;
}

export interface PortalSiteCreate {
  client_id: string;
  name: string;
  address?: string;
  is_default?: boolean;
  notes?: string;
}

export interface PortalContactCreate {
  client_id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  notes?: string;
  applies_to_all_sites?: boolean;
  site_ids?: string[];
}

export interface PortalSiteUpdate {
  name?: string;
  address?: string;
  is_default?: boolean;
  notes?: string;
}

export interface PortalContactUpdate {
  name?: string;
  phone?: string;
  email?: string;
  position?: string;
  notes?: string;
  applies_to_all_sites?: boolean;
  site_ids?: string[];
}

export const portalClientsApi = {
  /**
   * Get list of clients accessible to current portal user
   * For CLIENT_ADMIN: Returns all assigned clients from allowed_client_ids
   * For CLIENT_USER: Returns only their primary client
   */
  list: async (): Promise<PortalClientsListResponse> => {
    const response = await apiClient.get<PortalClientsListResponse>('/portal/clients');
    return response.data;
  },

  /**
   * Get details of a specific client
   * User must have access to this client via allowed_client_ids
   */
  get: async (clientId: string): Promise<PortalClient> => {
    const response = await apiClient.get<PortalClient>(`/portal/clients/${clientId}`);
    return response.data;
  },

  /**
   * Get list of sites for a specific client
   * For CLIENT_ADMIN: Returns all sites
   * For CLIENT_USER: Returns only allowed sites
   */
  listSites: async (clientId: string): Promise<PortalSitesListResponse> => {
    const response = await apiClient.get<PortalSitesListResponse>(`/portal/clients/${clientId}/sites`);
    return response.data;
  },

  /**
   * Get details of a specific site
   * User must have access to this site's client
   */
  getSite: async (siteId: string): Promise<PortalSite> => {
    const response = await apiClient.get<PortalSite>(`/portal/sites/${siteId}`);
    return response.data;
  },

  /**
   * Get list of contacts for a specific client
   * For CLIENT_ADMIN: Returns all contacts
   * For CLIENT_USER: Returns contacts with applies_to_all_sites=true or linked to allowed sites
   */
  listContacts: async (clientId: string): Promise<PortalContactsListResponse> => {
    const response = await apiClient.get<PortalContactsListResponse>(`/portal/clients/${clientId}/contacts`);
    return response.data;
  },

  /**
   * Get details of a specific contact
   * User must have access to this contact's client
   */
  getContact: async (contactId: string): Promise<PortalContact> => {
    const response = await apiClient.get<PortalContact>(`/portal/contacts/${contactId}`);
    return response.data;
  },

  /**
   * Create a new site (CLIENT_ADMIN only)
   */
  createSite: async (data: PortalSiteCreate): Promise<{ id: string; message: string }> => {
    const response = await apiClient.post<{ id: string; message: string }>(
      `/portal/clients/${data.client_id}/sites`,
      data
    );
    return response.data;
  },

  /**
   * Create a new contact (CLIENT_ADMIN only)
   */
  createContact: async (data: PortalContactCreate): Promise<{ id: string; message: string }> => {
    const response = await apiClient.post<{ id: string; message: string }>(
      `/portal/clients/${data.client_id}/contacts`,
      data
    );
    return response.data;
  },

  /**
   * Update an existing site (CLIENT_ADMIN only)
   */
  updateSite: async (siteId: string, data: PortalSiteUpdate): Promise<{ id: string; message: string }> => {
    const response = await apiClient.patch<{ id: string; message: string }>(
      `/portal/sites/${siteId}`,
      data
    );
    return response.data;
  },

  /**
   * Update an existing contact (CLIENT_ADMIN only)
   */
  updateContact: async (contactId: string, data: PortalContactUpdate): Promise<{ id: string; message: string }> => {
    const response = await apiClient.patch<{ id: string; message: string }>(
      `/portal/contacts/${contactId}`,
      data
    );
    return response.data;
  },
};

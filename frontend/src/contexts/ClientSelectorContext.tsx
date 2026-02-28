/**
 * ClientSelectorContext: Manages multi-client access for CLIENT_ADMIN users.
 *
 * Provides:
 * - Active client state
 * - Available clients list
 * - Client switching functionality
 * - Persistence in localStorage
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { ClientOption, SwitchClientRequest, SwitchClientResponse } from '../types';
import { portalClientsApi } from '../api/portalClients';
import { portalAuthApi } from '../api/auth';

interface ClientSelectorContextType {
  activeClientId: string | null;
  availableClients: ClientOption[];
  canSwitchClients: boolean;
  switchClient: (clientId: string) => Promise<void>;
  isLoading: boolean;
}

const ClientSelectorContext = createContext<ClientSelectorContextType | undefined>(undefined);

export const useClientSelector = () => {
  const context = useContext(ClientSelectorContext);
  if (!context) {
    throw new Error('useClientSelector must be used within ClientSelectorProvider');
  }
  return context;
};

interface ClientSelectorProviderProps {
  children: ReactNode;
}

const ACTIVE_CLIENT_KEY = 'active_client_id';

export const ClientSelectorProvider: React.FC<ClientSelectorProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [availableClients, setAvailableClients] = useState<ClientOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Check if user can switch clients (CLIENT_ADMIN with multiple clients)
  const canSwitchClients = Boolean(
    user?.role === 'client_admin' &&
    user?.allowed_client_ids &&
    user.allowed_client_ids.length > 1
  );

  // Load available clients on mount or when user changes
  useEffect(() => {
    const loadAvailableClients = async () => {
      // Only load for portal users with allowed_client_ids
      if (!user || user.user_type !== 'portal') {
        setAvailableClients([]);
        setActiveClientId(null);
        return;
      }

      if (!user.allowed_client_ids || user.allowed_client_ids.length === 0) {
        setAvailableClients([]);
        setActiveClientId(user?.client_id || null);
        return;
      }

      setIsLoading(true);
      try {
        // Use portal clients API to get all assigned clients
        const response = await portalClientsApi.list();

        const clients = response.items.map(client => ({
          id: client.id,
          name: client.name
        }));

        setAvailableClients(clients);

        // Set active client from user.client_id (from token)
        setActiveClientId(user.client_id || null);
      } catch (error) {
        console.error('Failed to load available clients:', error);
        // Fallback: create client options from allowed_client_ids
        const fallbackClients = user.allowed_client_ids.map(id => ({
          id,
          name: `Client ${id.substring(0, 8)}...`
        }));
        setAvailableClients(fallbackClients);
        setActiveClientId(user.client_id || null);
      } finally {
        setIsLoading(false);
      }
    };

    loadAvailableClients();
  }, [user]);

  /**
   * Switch to a different client by calling the backend API to get a new token.
   * Reloads the page to refresh all data with the new client context.
   */
  const switchClient = async (clientId: string): Promise<void> => {
    if (!user || !user.allowed_client_ids || !user.allowed_client_ids.includes(clientId)) {
      throw new Error('Cannot switch to this client');
    }

    setIsLoading(true);
    try {
      // Use portal auth API to switch client
      const data = await portalAuthApi.switchClient(clientId);

      // Update token in localStorage
      localStorage.setItem('access_token', data.access_token);

      // Store active client preference
      localStorage.setItem(ACTIVE_CLIENT_KEY, data.client_id);

      // Reload page to refresh all contexts with new token
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch client:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: ClientSelectorContextType = {
    activeClientId,
    availableClients,
    canSwitchClients,
    switchClient,
    isLoading
  };

  return (
    <ClientSelectorContext.Provider value={value}>
      {children}
    </ClientSelectorContext.Provider>
  );
};

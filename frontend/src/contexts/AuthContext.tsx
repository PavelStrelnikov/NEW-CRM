import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { portalAuthApi } from '@/api/auth';
import { adminAuthApi } from '@/api/adminAuth';
import { logger } from '@/utils/logger';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  isLoading: true,
});

interface AuthProviderProps {
  children: ReactNode;
}

// Determine which API to use based on current route or token
function getAuthApi(pathname?: string, token?: string) {
  // If we have a token, decode it to check user_type
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.user_type === 'internal') {
          return adminAuthApi;
        } else if (payload.user_type === 'portal') {
          return portalAuthApi;
        }
      }
    } catch (e) {
      logger.error('Failed to decode token:', e);
    }
  }

  // Fallback: check current pathname
  if (pathname) {
    if (pathname.startsWith('/admin')) {
      return adminAuthApi;
    } else if (pathname.startsWith('/portal')) {
      return portalAuthApi;
    }
  }

  // Default to portal API for backward compatibility
  return portalAuthApi;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('access_token')
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        try {
          // Determine which API to use based on token
          const api = getAuthApi(window.location.pathname, storedToken);
          const userData = await api.getCurrentUser();
          setUser(userData);
          setToken(storedToken);
        } catch (error) {
          logger.error('Failed to load user:', error);
          localStorage.removeItem('access_token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    // This function is deprecated - login pages should use adminAuthApi or portalAuthApi directly
    // Kept for backward compatibility
    const api = getAuthApi(window.location.pathname);
    const response = await api.login({ email, password });
    localStorage.setItem('access_token', response.access_token);
    setToken(response.access_token);

    const userData = await api.getCurrentUser();
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

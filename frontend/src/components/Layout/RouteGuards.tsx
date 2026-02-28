import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * AdminRoute: Protects admin-only routes
 * - Requires user to be logged in
 * - Requires user to be internal (user_type === 'internal')
 * - Redirects portal users to /portal/tickets
 * - Redirects unauthenticated users to /admin/login
 */
export const AdminRoute: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.user_type !== 'internal') {
    return <Navigate to="/portal/tickets" replace />;
  }

  return <>{children}</>;
};

/**
 * PortalRoute: Protects portal-only routes
 * - Requires user to be logged in
 * - Requires user to be portal (user_type === 'portal')
 * - Redirects internal users to /admin/clients
 * - Redirects unauthenticated users to /portal/login
 */
export const PortalRoute: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  if (user.user_type === 'internal') {
    return <Navigate to="/admin/clients" replace />;
  }

  return <>{children}</>;
};

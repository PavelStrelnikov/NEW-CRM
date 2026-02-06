import React, { useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { create } from 'jss';
import rtl from 'jss-rtl';
import { StylesProvider, jssPreset } from '@mui/styles';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import stylisRTLPlugin from 'stylis-plugin-rtl';

import { createAppTheme } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import { DirectionProvider, useDirection } from './contexts/DirectionContext';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeModeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ClientSelectorProvider } from './contexts/ClientSelectorContext';
import { ProtectedRoute } from './components/Layout/ProtectedRoute';
import { AppLayout } from './components/Layout/AppLayout';
import { AdminLayout } from './components/Layout/AdminLayout';
import { PortalLayout } from './components/Layout/PortalLayout';
import { AdminRoute, PortalRoute } from './components/Layout/RouteGuards';

import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';
import { PortalLogin } from './pages/PortalLogin';
import { useParams } from 'react-router-dom';

// Helper component for dynamic redirects that preserve route params
const RedirectWithParams: React.FC<{ to: string }> = ({ to }) => {
  const params = useParams();
  // Replace :id with actual id from params
  const path = to.replace(':id', params.id || '');
  return <Navigate to={path} replace />;
};
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailsPage } from './pages/ClientDetailsPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailsPage } from './pages/TicketDetailsPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailsPage } from './pages/AssetDetailsPage';
import { InternalUsersPage } from './pages/InternalUsersPage';
import { PortalUsersPage } from './pages/PortalUsersPage';

import './i18n/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Create RTL cache for Emotion
const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, stylisRTLPlugin],
});

// Create LTR cache for Emotion
const cacheLtr = createCache({
  key: 'muiltr',
});

// Configure JSS with RTL
const jssRtl = create({ plugins: [...jssPreset().plugins, rtl()] });
const jssLtr = create({ plugins: [...jssPreset().plugins] });

function AppContent() {
  const { direction } = useDirection();
  const { mode } = useThemeMode();

  const theme = useMemo(() => createAppTheme(direction, mode), [direction, mode]);
  const emotionCache = useMemo(() => direction === 'rtl' ? cacheRtl : cacheLtr, [direction]);
  const jss = useMemo(() => direction === 'rtl' ? jssRtl : jssLtr, [direction]);

  return (
    <CacheProvider value={emotionCache}>
      <StylesProvider jss={jss}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthProvider>
                <ClientSelectorProvider>
                  <Router>
                  <Routes>
                  {/* Auth routes - no protection */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/portal/login" element={<PortalLogin />} />

                  {/* Default redirect */}
                  <Route path="/" element={<Navigate to="/admin/clients" replace />} />

                  {/* ========== ADMIN ROUTES ========== */}
                  <Route path="/admin/*" element={
                    <AdminRoute>
                      <AdminLayout>
                        <Routes>
                          <Route path="dashboard" element={<DashboardPage />} />
                          <Route path="clients" element={<ClientsPage />} />
                          <Route path="clients/:id" element={<ClientDetailsPage />} />
                          <Route path="tickets" element={<TicketsPage />} />
                          <Route path="tickets/:id" element={<TicketDetailsPage />} />
                          <Route path="assets" element={<AssetsPage />} />
                          <Route path="assets/:id" element={<AssetDetailsPage />} />
                          <Route path="users" element={<InternalUsersPage />} />
                          <Route path="portal-users" element={<PortalUsersPage />} />
                        </Routes>
                      </AdminLayout>
                    </AdminRoute>
                  } />

                  {/* ========== PORTAL ROUTES ========== */}
                  <Route path="/portal/*" element={
                    <PortalRoute>
                      <PortalLayout>
                        <Routes>
                          <Route path="dashboard" element={<DashboardPage />} />
                          <Route path="clients" element={<ClientsPage />} />
                          <Route path="clients/:id" element={<ClientDetailsPage />} />
                          <Route path="tickets" element={<TicketsPage />} />
                          <Route path="tickets/:id" element={<TicketDetailsPage />} />
                          <Route path="assets" element={<AssetsPage />} />
                          <Route path="assets/:id" element={<AssetDetailsPage />} />
                        </Routes>
                      </PortalLayout>
                    </PortalRoute>
                  } />

                  {/* ========== LEGACY ROUTES (backward compatibility) ========== */}
                  <Route path="/clients" element={<Navigate to="/admin/clients" replace />} />
                  <Route path="/clients/:id" element={<RedirectWithParams to="/admin/clients/:id" />} />
                  <Route path="/tickets" element={<Navigate to="/admin/tickets" replace />} />
                  <Route path="/tickets/:id" element={<RedirectWithParams to="/admin/tickets/:id" />} />
                  <Route path="/assets" element={<Navigate to="/admin/assets" replace />} />
                  <Route path="/assets/:id" element={<RedirectWithParams to="/admin/assets/:id" />} />
                  <Route path="/users" element={<Navigate to="/admin/users" replace />} />
                  <Route path="/portal-users" element={<Navigate to="/admin/portal-users" replace />} />
                  <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
                  </Router>
                </ClientSelectorProvider>
              </AuthProvider>
            </ToastProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </StylesProvider>
    </CacheProvider>
  );
}

function App() {
  return (
    <ThemeModeProvider>
      <DirectionProvider>
        <AppContent />
      </DirectionProvider>
    </ThemeModeProvider>
  );
}

export default App;

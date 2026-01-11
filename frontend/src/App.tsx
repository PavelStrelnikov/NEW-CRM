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
import { ProtectedRoute } from './components/Layout/ProtectedRoute';
import { AppLayout } from './components/Layout/AppLayout';

import { Login } from './pages/Login';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailsPage } from './pages/ClientDetailsPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailsPage } from './pages/TicketDetailsPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailsPage } from './pages/AssetDetailsPage';

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
                <Router>
                  <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Navigate to="/dashboard" replace />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <DashboardPage />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/clients"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ClientsPage />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/clients/:id"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ClientDetailsPage />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tickets"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <TicketsPage />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tickets/:id"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <TicketDetailsPage />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assets"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <AssetsPage />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/assets/:id"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <AssetDetailsPage />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Router>
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
